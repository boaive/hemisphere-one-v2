"""HEMISPHERE ONE - web (glTF) human pipeline: build in rest pose, bake procedural looks to textures,
strip to a web budget, add eye bones + morph targets. Base mesh: MPFB/MakeHuman (CC0). No downloaded assets."""
import bpy, bmesh, math, os, random
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
from mathutils.geometry import barycentric_transform
from ho_common import *
from ho_parts import *

WORK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_work")

def ctx(ob, sel=None):
    sel = sel or [ob]
    return bpy.context.temp_override(object=ob, active_object=ob, selected_objects=sel, selected_editable_objects=sel)

def apply_mod(ob, name):
    with ctx(ob):
        bpy.ops.object.modifier_apply(modifier=name)

def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)

def delete_verts(ob, keep):
    bmh = bmesh.new(); bmh.from_mesh(ob.data); bmh.verts.ensure_lookup_table()
    bmesh.ops.delete(bmh, geom=[v for v in bmh.verts if v.index not in keep], context='VERTS')
    bmh.to_mesh(ob.data); bmh.free(); ob.data.update()

# ------------------------------------------------------------------ clothes classification (web version)
TORSO = {"spine_01", "spine_02", "spine_03", "clavicle_l", "clavicle_r", "pelvis"}
def classify_web(bm, rig, cfg):
    me = bm.data
    body = vg_set(bm, "body")
    dom = dominant_bones(bm, rig)
    B = rig.data.bones
    belt_z = B["spine_01"].head_local.z - 0.01
    clav_z = B["clavicle_l"].head_local.z
    ankle_z = B["foot_l"].head_local.z
    sleeve = cfg["sleeve"]
    R = {k: set() for k in ("shirt", "trousers", "boots")}
    def t_along(bn, p):
        b = B[bn]; a = b.head_local; v = b.tail_local - a
        return (p - a).dot(v) / v.length_squared
    for i in body:
        p = me.vertices[i].co; d = dom[i]
        if d is None: continue
        if sleeve == "none" and (d in TORSO or d.startswith("upperarm") or d == "neck_01"):
            # cotton banian by shape: deep armholes, ~4.5 cm straps, scoop neck front and back
            ax = abs(p.x)
            armpit = B["upperarm_l"].head_local.z - 0.095
            ok = p.z > belt_z - cfg["tuck"] and (ax <= 0.118 or p.z < armpit) and ax < 0.2
            ok = ok and p.z < clav_z + 0.07 and (d != "neck_01" or ax > 0.055)
            if p.y < -0.03 and ax < 0.072 and p.z > clav_z - 0.085 + (ax / 0.072) ** 2 * 0.075: ok = False
            if p.y >= -0.03 and ax < 0.068 and p.z > clav_z - 0.06 + (ax / 0.068) ** 2 * 0.05: ok = False
            if ok: R["shirt"].add(i)
        elif d in TORSO or d.startswith("upperarm") or d.startswith("lowerarm") or d == "neck_01":
            ok = p.z > belt_z - cfg["tuck"]
            if d == "neck_01":
                ok = ok and p.z < clav_z + (0.005 if p.y > -0.02 else -0.02)
            if d.startswith("lowerarm"):
                ok = ok and sleeve in ("rolled", "full") and t_along(d, p) < (0.32 if sleeve == "rolled" else 0.93)
            if d.startswith("upperarm"):
                ok = ok and (sleeve != "none") and (sleeve != "half" or t_along(d, p) < 0.62)
            if sleeve == "none" and d in TORSO:
                # cotton banian: deep armholes, 4 cm straps over the shoulders, scoop neck front and back
                ax = abs(p.x)
                arm_hole = ax > 0.118 and p.z > B["upperarm_l"].head_local.z - 0.095
                scoop = p.y < -0.03 and ax < 0.072 and p.z > clav_z - 0.11 + (ax / 0.072) ** 2 * 0.09
                back = p.y > 0.03 and ax < 0.068 and p.z > clav_z - 0.06 + (ax / 0.068) ** 2 * 0.05
                ok = ok and not arm_hole and not scoop and not back
            if d == "pelvis" and p.z < belt_z - cfg["tuck"]: ok = False
            if cfg.get("neck") == "crew" and p.y < -0.03 and abs(p.x) < 0.07 and p.z > clav_z - 0.035 + (abs(p.x) / 0.07) ** 2 * 0.03:
                ok = False
            if ok: R["shirt"].add(i)
        if d in ("pelvis", "thigh_l", "thigh_r", "calf_l", "calf_r", "spine_01"):
            if belt_z + 0.004 > p.z > ankle_z + cfg["hem"]:
                R["trousers"].add(i)
        if d in ("foot_l", "foot_r", "ball_l", "ball_r") or (d in ("calf_l", "calf_r") and p.z < ankle_z + cfg["boot_h"]):
            R["boots"].add(i)
    return R, belt_z, clav_z, ankle_z

# ------------------------------------------------------------------ shirt material with seams, placket, buttons, dust
def shirt_material(name, hex_, rig, clav_z, belt_z, dust=0.2, sweat=0.25, placket=True, dirt=0.2, plain_vest=False):
    m = bpy.data.materials.new(name); nb = NB(m)
    P = nb.metric()
    sep = nb.n("ShaderNodeSeparateXYZ"); nb.l(P, sep.inputs[0])
    X, Y, Z = sep.outputs[0], sep.outputs[1], sep.outputs[2]
    ax = nb.math('ABSOLUTE', X)
    S = rig.data.bones["upperarm_l"].head_local
    ymid = S.y
    lines = []
    # side + shoulder seam (plane through the shoulder joints)
    lines.append(nb.math('MULTIPLY', nb.maprange(nb.math('ABSOLUTE', nb.math('SUBTRACT', Y, ymid + 0.004)), 0.0018, 0.0008), nb.maprange(ax, 0.06, 0.08)))
    if not plain_vest:
        # armhole ring
        d = nb.n("ShaderNodeVectorMath", operation='DISTANCE'); nb.l(P, d.inputs[0])
        d2 = nb.n("ShaderNodeVectorMath", operation='DISTANCE'); nb.l(P, d2.inputs[0])
        d.inputs[1].default_value = S; d2.inputs[1].default_value = Vector((-S.x, S.y, S.z))
        dm = nb.math('MINIMUM', d.outputs["Value"], d2.outputs["Value"])
        lines.append(nb.maprange(nb.math('ABSOLUTE', nb.math('SUBTRACT', dm, 0.072)), 0.0018, 0.0008))
        # back yoke
        back = nb.maprange(Y, 0.02, 0.04)
        lines.append(nb.math('MULTIPLY', back, nb.maprange(nb.math('ABSOLUTE', nb.math('SUBTRACT', Z, clav_z - 0.085)), 0.0016, 0.0007)))
    front = nb.maprange(Y, -0.03, -0.05)
    btn = None
    if placket:
        pl = nb.math('MULTIPLY', front, nb.math('MULTIPLY', nb.maprange(nb.math('ABSOLUTE', nb.math('SUBTRACT', ax, 0.016)), 0.0016, 0.0007),
                                                  nb.maprange(Z, clav_z + 0.01, clav_z - 0.0)))
        lines.append(pl)
        # chest pocket (wearer's left)
        px = nb.math('MULTIPLY', nb.maprange(X, 0.045, 0.047), nb.maprange(X, 0.115, 0.113))
        pz = nb.math('MULTIPLY', nb.maprange(Z, clav_z - 0.175, clav_z - 0.173), nb.maprange(Z, clav_z - 0.075, clav_z - 0.077))
        inside = nb.math('MULTIPLY', nb.math('MULTIPLY', px, pz), front)
        edge = nb.math('MULTIPLY', inside, nb.math('SUBTRACT', 1.0, nb.math('MULTIPLY',
                    nb.math('MULTIPLY', nb.maprange(X, 0.048, 0.050), nb.maprange(X, 0.112, 0.110)),
                    nb.math('MULTIPLY', nb.maprange(Z, clav_z - 0.172, clav_z - 0.170), nb.maprange(Z, clav_z - 0.08, clav_z - 0.082)))))
        lines.append(edge)
        # buttons on the placket
        z0 = clav_z - 0.06
        zs = nb.math('SUBTRACT', Z, z0)
        zsn = nb.math('SNAP', zs, 0.085)
        dz = nb.math('SUBTRACT', zs, zsn)
        cmb = nb.n("ShaderNodeCombineXYZ"); nb.l(X, cmb.inputs[0]); nb.l(dz, cmb.inputs[1])
        ln = nb.n("ShaderNodeVectorMath", operation='LENGTH'); nb.l(cmb.outputs[0], ln.inputs[0])
        btn = nb.math('MULTIPLY', nb.math('MULTIPLY', nb.maprange(ln.outputs["Value"], 0.0058, 0.0048), front),
                      nb.math('MULTIPLY', nb.maprange(Z, z0 + 0.01, z0 + 0.005), nb.maprange(Z, belt_z + 0.02, belt_z + 0.04)))
    seam = lines[0]
    for l_ in lines[1:]: seam = nb.math('MAXIMUM', seam, l_)
    base = srgb(hex_)
    big = nb.noise(P, 4.0, 5.0, 0.6)
    c = nb.mixc('MULTIPLY', nb.maprange(big, 0.4, 0.7, 0.0, dirt), base, (0.75, 0.72, 0.66, 1))
    slub = nb.noise(P, 700.0, 2.0, 0.5)
    c = nb.mixc('MULTIPLY', nb.maprange(slub, 0.3, 0.7, 0.0, 0.10), c, (0.8, 0.8, 0.8, 1))
    if sweat > 0:
        c = nb.mixc('MULTIPLY', nb.maprange(nb.noise(P, 3.0, 3.0, 0.5), 0.56, 0.68, 0.0, sweat), c, (0.7, 0.7, 0.7, 1))
    c = nb.mixc('MULTIPLY', nb.math('MULTIPLY', seam, 0.55), c, (0.55, 0.55, 0.58, 1))
    if dust > 0:
        dn = nb.noise(P, 3.0, 4.0, 0.55)
        low = nb.maprange(Z, belt_z + 0.25, belt_z - 0.05)
        dm = nb.math('MULTIPLY', nb.maprange(dn, 0.42, 0.78, 0.0, 0.8), nb.math('ADD', nb.math('MULTIPLY', low, 0.7), 0.3))
        c = nb.mixc('MIX', nb.math('MULTIPLY', dm, dust), c, (0.52, 0.50, 0.46, 1))
    if btn is not None:
        c = nb.mixc('MIX', btn, c, (0.62, 0.60, 0.55, 1))
    weave = nb.n("ShaderNodeTexWave", wave_type='BANDS', bands_direction='X'); nb.l(P, weave.inputs["Vector"]); weave.inputs["Scale"].default_value = 1600.0
    weave2 = nb.n("ShaderNodeTexWave", wave_type='BANDS', bands_direction='Z'); nb.l(P, weave2.inputs["Vector"]); weave2.inputs["Scale"].default_value = 1600.0
    h = nb.math('ADD', weave.outputs["Fac"], weave2.outputs["Fac"])
    h = nb.math('SUBTRACT', h, nb.math('MULTIPLY', seam, 3.0))
    if btn is not None: h = nb.math('ADD', h, nb.math('MULTIPLY', btn, 3.0))
    h = nb.math('ADD', h, nb.math('MULTIPLY', nb.noise(P, 40.0, 6.0, 0.6), 2.5))
    bump = nb.n("ShaderNodeBump"); nb.l(h, bump.inputs["Height"])
    bump.inputs["Strength"].default_value = 0.35; bump.inputs["Distance"].default_value = 0.0005
    r = nb.mixf(btn if btn is not None else 0.0, 0.84, 0.35)
    p = principled(nb, Base_Color=c, Roughness=r, Sheen_Weight=0.3, Sheen_Roughness=0.6, Specular_IOR_Level=0.35)
    nb.l(bump.outputs[0], p.inputs["Normal"]); nb.out(p.outputs[0])
    return m

# ------------------------------------------------------------------ face hair masks (painted + alpha shells)
def write_hair_masks(bm, info, style):
    """HO_mask3: R brows, G moustache, B lash line, A beard-hair density (stubble length)."""
    me = bm.data
    El, Er = info["eye_l"], info["eye_r"]; lip_top = info["lip_top"]
    r_eye = (info["eye_r_size"].x + info["eye_r_size"].z) / 4.0
    lash = set()
    for g in ("helper-l-eyelashes-1", "helper-l-eyelashes-2", "helper-r-eyelashes-1", "helper-r-eyelashes-2"):
        lash |= vg_set(bm, g)
    kd = KDTree(len(lash))
    for k, i in enumerate(lash): kd.insert(me.vertices[i].co, k)
    kd.balance()
    body = vg_set(bm, "body")
    out = [0.0] * (len(me.vertices) * 4)
    bw_ = style.get("brow_w", 1.0); mw = style.get("moustache", 0.0); mh = style.get("moustache_h", 0.0155)
    for i in body:
        v = me.vertices[i]; c = v.co; n = v.normal
        br = 0.0
        if n.y < -0.2:
            for E, sgn in ((El, 1), (Er, -1)):
                dx = (c.x - E.x) * sgn
                if -0.021 < dx < 0.028:
                    u = (dx + 0.021) / 0.049
                    zc = E.z + 0.0125 + 0.0065 * math.sin(min(1.0, u * 1.35) * math.pi * 0.85) - 0.004 * max(0, u - 0.7) / 0.3
                    half = (0.0050 * (1 - u) + 0.0022 * u) * bw_
                    dz = abs(c.z - zc)
                    if dz < half * 1.4:
                        br = max(br, min(1.0, (half * 1.4 - dz) / (half * 0.6)) * (1.0 - 0.35 * u))
        mo = 0.0
        if mw > 0 and n.y < -0.15:
            axx = abs(c.x)
            if axx < 0.031:
                ztop = lip_top + mh - 0.008 * (axx / 0.031) ** 2
                zbot = lip_top + 0.0003 - 0.007 * (axx / 0.031) ** 2
                if zbot < c.z < ztop:
                    mo = mw * min(1.0, (ztop - c.z) / 0.003) * min(1.0, (0.031 - axx) / 0.004)
                    if axx < 0.0035 and c.z > lip_top + 0.006: mo *= 0.55
        ll = 0.0
        dist = kd.find(c)[2] if lash else 1
        if dist < 0.003 and abs((c - (El if c.x > 0 else Er)).length - r_eye) < 0.006:
            E = El if c.x > 0 else Er
            ll = (1.0 - dist / 0.003) * (1.0 if c.z > E.z else 0.5)
        out[i*4:i*4+4] = (br, mo, ll, 0.0)
    if "HO_mask3" in me.color_attributes: me.color_attributes.remove(me.color_attributes["HO_mask3"])
    a = me.color_attributes.new("HO_mask3", 'FLOAT_COLOR', 'POINT')
    a.data.foreach_set("color", out)

def skin_material_web(name, tone_hex, sss_scale=0.003, red_amt=0.2, stubble=0.7, grey=0.0, dust=0.0,
                      hair_col=(0.014, 0.010, 0.008, 1), brow_grey=0.0):
    """Procedural skin (Object coords) incl. painted brows/moustache/lash line. Nodes named for bake rewiring."""
    mat = bpy.data.materials.new(name)
    nb = NB(mat)
    P = nb.metric()
    R1, G1, B1, A1 = nb.attr("HO_mask")
    R2, G2, B2, A2 = nb.attr("HO_mask2")
    R3, G3, B3, A3 = nb.attr("HO_mask3")
    base = srgb(tone_hex)
    n1 = nb.noise(P, 18.0, 5.0, 0.55); n2 = nb.noise(P, 90.0, 3.0, 0.5); n3 = nb.noise(P, 260.0, 4.0, 0.6)
    var = nb.maprange(nb.math('ADD', nb.math('ADD', n1, nb.math('MULTIPLY', n2, 0.35)), nb.math('MULTIPLY', n3, 0.25)), 0.5, 1.2, 0.85, 1.08, smooth=False)
    cv = nb.n("ShaderNodeCombineColor")
    for i in range(3): nb.l(var, cv.inputs[i])
    c = nb.mixc('MULTIPLY', 1.0, base, cv.outputs[0])
    c = nb.mixc('MULTIPLY', nb.math('MULTIPLY', G1, red_amt), c, (1.35, 0.78, 0.72, 1))
    c = nb.mixc('MULTIPLY', nb.math('MULTIPLY', A2, 0.9), c, (0.78, 0.74, 0.76, 1))
    c = nb.mixc('MULTIPLY', nb.math('MULTIPLY', A1, 0.9), c, (0.74, 0.70, 0.70, 1))
    c = nb.mixc('MULTIPLY', nb.math('MULTIPLY', R2, 0.85), c, (0.84, 0.64, 0.66, 1))
    c = nb.mixc('MIX', nb.math('MULTIPLY', B2, 0.75), c, (0.40, 0.29, 0.25, 1))
    # stubble
    dots = nb.maprange(nb.voronoi(P, 2200.0), 0.30, 0.12)
    c = nb.mixc('MULTIPLY', nb.math('MULTIPLY', R1, 0.5), c, (0.70, 0.70, 0.74, 1))
    sfac = nb.math('MULTIPLY', nb.math('MULTIPLY', R1, dots), stubble)
    scol = tuple(hair_col[i] * (1 - grey) + 0.32 * grey for i in range(3)) + (1,)
    c = nb.mixc('MIX', sfac, c, scol)
    # scalp crop
    hn = nb.noise(P, 1400.0, 2.0, 0.6)
    c = nb.mixc('MIX', nb.math('MULTIPLY', G2, nb.maprange(hn, 0.35, 0.6, 0.75, 1.0)), c, scol)
    # brows (lateral strands) and moustache (vertical strands)
    mpb = nb.n("ShaderNodeMapping"); nb.l(P, mpb.inputs[0]); mpb.inputs["Scale"].default_value = (110.0, 2600.0, 2400.0)
    mpm = nb.n("ShaderNodeMapping"); nb.l(P, mpm.inputs[0]); mpm.inputs["Scale"].default_value = (2600.0, 2600.0, 160.0)
    sb = nb.maprange(nb.noise(mpb.outputs[0], 1.0, 3.0, 0.5), 0.40, 0.62)
    sm = nb.maprange(nb.noise(mpm.outputs[0], 1.0, 3.0, 0.5), 0.38, 0.62)
    covb = nb.math('MULTIPLY', nb.maprange(R3, 0.05, 0.6), nb.math('ADD', nb.math('MULTIPLY', sb, 0.75), 0.35), clamp=True)
    covm = nb.math('MULTIPLY', nb.maprange(G3, 0.05, 0.6), nb.math('ADD', nb.math('MULTIPLY', sm, 0.75), 0.35), clamp=True)
    cov = nb.math('MAXIMUM', covb, covm)
    hvar = nb.noise(P, 300.0, 2.0, 0.5)
    hc = nb.mixc('MULTIPLY', nb.maprange(hvar, 0.3, 0.7, 0.0, 1.0), hair_col, (1.6, 1.5, 1.4, 1))
    if brow_grey > 0:
        gm = nb.math('GREATER_THAN', nb.noise(nb.n("ShaderNodeMapping").outputs[0] if False else P, 900.0, 1.0, 0.5), 1.0 - brow_grey * 0.5)
        hc = nb.mixc('MIX', gm, hc, (0.36, 0.34, 0.32, 1))
    c = nb.mixc('MIX', nb.math('MULTIPLY', cov, 0.94), c, hc)
    c = nb.mixc('MULTIPLY', nb.math('MULTIPLY', B3, 0.85), c, (0.35, 0.32, 0.32, 1))
    if dust > 0:
        dm = nb.math('MULTIPLY', nb.maprange(nb.noise(P, 6.0, 6.0, 0.6), 0.48, 0.7), dust)
        c = nb.mixc('MIX', dm, c, (0.30, 0.28, 0.25, 1))
    r = nb.maprange(n2, 0.3, 0.7, 0.56, 0.68, smooth=False)
    r = nb.mixf(B1, r, 0.47); r = nb.mixf(R2, r, 0.50); r = nb.mixf(B2, r, 0.26); r = nb.mixf(G2, r, 0.62)
    r = nb.mixf(cov, r, 0.5)
    pores = nb.maprange(nb.voronoi(P, 950.0, 0.9), 0.0, 0.45, 0.0, 1.0)
    mid = nb.noise(P, 45.0, 6.0, 0.6); fine = nb.noise(P, 380.0, 8.0, 0.65)
    h = nb.math('ADD', nb.math('MULTIPLY', pores, 0.8), nb.math('MULTIPLY', fine, 0.6))
    h = nb.math('ADD', h, nb.math('MULTIPLY', mid, 1.6))
    h = nb.math('ADD', h, nb.math('MULTIPLY', nb.math('ADD', sfac, cov), 0.6))
    bump = nb.n("ShaderNodeBump"); nb.l(h, bump.inputs["Height"])
    bump.inputs["Strength"].default_value = 0.55; bump.inputs["Distance"].default_value = 0.0004
    p = principled(nb, Base_Color=c, Roughness=r, Subsurface_Weight=1.0, Subsurface_Radius=(1.0, 0.40, 0.25),
                   Subsurface_Scale=sss_scale, Specular_IOR_Level=0.42)
    p.name = "SKIN_BSDF"
    nb.l(bump.outputs[0], p.inputs["Normal"])
    em = nb.n("ShaderNodeEmission"); em.name = "HAIR_ALPHA"
    nb.l(nb.math('MULTIPLY', cov, 1.25, clamp=True), em.inputs["Color"])
    nb.out(p.outputs[0])
    return mat

# ------------------------------------------------------------------ baking
def setup_cycles(samples=4):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = samples
    sc.cycles.device = 'CPU'
    try: sc.cycles.use_denoising = False
    except Exception: pass
    sc.render.bake.margin = 6

def new_img(name, size, non_color=False, alpha=False):
    im = bpy.data.images.get(name)
    if im: bpy.data.images.remove(im)
    im = bpy.data.images.new(name, size, size, alpha=alpha)
    if non_color: im.colorspace_settings.name = 'Non-Color'
    return im

def bake(obs, btype, img, mats=None, pass_filter=None, emit_node=None):
    """Bake every material on `obs` into `img`. For EMIT with emit_node, temporarily wire that node to the output."""
    mats = mats or {m for o in obs for m in o.data.materials if m}
    rewired = []
    for m in mats:
        nt = m.node_tree
        n = nt.nodes.get("BAKE_TARGET") or nt.nodes.new("ShaderNodeTexImage")
        n.name = "BAKE_TARGET"; n.image = img; nt.nodes.active = n
        if emit_node:
            out = next(x for x in nt.nodes if x.type == 'OUTPUT_MATERIAL')
            src = nt.nodes.get(emit_node)
            old = out.inputs["Surface"].links[0].from_socket if out.inputs["Surface"].links else None
            if src:
                nt.links.new(src.outputs[0], out.inputs["Surface"])
            else:
                e = nt.nodes.new("ShaderNodeEmission"); e.name = "TMP_BLACK"; e.inputs[0].default_value = (0, 0, 0, 1)
                nt.links.new(e.outputs[0], out.inputs["Surface"])
            rewired.append((nt, out, old))
    kw = dict(type=btype, margin=6, use_clear=True)
    if pass_filter: kw["pass_filter"] = pass_filter
    if btype == 'NORMAL': kw["normal_space"] = 'TANGENT'
    with bpy.context.temp_override(object=obs[0], active_object=obs[0], selected_objects=obs, selected_editable_objects=obs):
        bpy.ops.object.bake(**kw)
    for nt, out, old in rewired:
        if old: nt.links.new(old, out.inputs["Surface"])
        t = nt.nodes.get("TMP_BLACK")
        if t: nt.nodes.remove(t)
    for m in mats:
        n = m.node_tree.nodes.get("BAKE_TARGET")
        if n: m.node_tree.nodes.remove(n)

def save_img(img, role, fmt='PNG'):
    os.makedirs(WORK, exist_ok=True)
    path = os.path.join(WORK, f"{role}_{img.name}.png")
    img.filepath_raw = path; img.file_format = fmt; img.save()
    return img

def gltf_mat(name, base_img=None, base_col=(0.8, 0.8, 0.8, 1), rough_img=None, rough=0.5, normal_img=None, metal=0.0,
             use_alpha=False, double=False, emit_img=None, emit_strength=1.0, alpha=1.0, coat=0.0, coat_rough=0.03):
    m = bpy.data.materials.new(name); nb = NB(m)
    p = nb.n("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = base_col
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    p.inputs["Alpha"].default_value = alpha
    if base_img:
        t = nb.n("ShaderNodeTexImage"); t.image = base_img
        nb.l(t.outputs["Color"], p.inputs["Base Color"])
        if use_alpha: nb.l(t.outputs["Alpha"], p.inputs["Alpha"])
    if rough_img:
        t = nb.n("ShaderNodeTexImage"); t.image = rough_img
        nb.l(t.outputs["Color"], p.inputs["Roughness"])
    if normal_img:
        t = nb.n("ShaderNodeTexImage"); t.image = normal_img
        nm = nb.n("ShaderNodeNormalMap"); nb.l(t.outputs["Color"], nm.inputs["Color"]); nb.l(nm.outputs[0], p.inputs["Normal"])
    if emit_img:
        t = nb.n("ShaderNodeTexImage"); t.image = emit_img
        nb.l(t.outputs["Color"], p.inputs["Emission Color"]); p.inputs["Emission Strength"].default_value = emit_strength
    if coat > 0:
        p.inputs["Coat Weight"].default_value = coat; p.inputs["Coat Roughness"].default_value = coat_rough
    nb.out(p.outputs[0])
    m.use_backface_culling = not double
    if use_alpha or alpha < 1.0:
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
    return m

# ------------------------------------------------------------------ decimation that keeps morph targets
def decimate_keep_keys(ob, ratio, dense_group="dense"):
    me = ob.data
    keys = [(k.name, np.array([d.co[:] for d in k.data])) for k in me.shape_keys.key_blocks] if me.shape_keys else []
    tracks = []
    if me.shape_keys and me.shape_keys.animation_data:
        for tr in me.shape_keys.animation_data.nla_tracks:
            tracks.append((tr.name, [(st.name, st.action, st.frame_start) for st in tr.strips]))
    base_co = np.array([v.co[:] for v in me.vertices])
    me.calc_loop_triangles()
    tris = [tuple(t.vertices) for t in me.loop_triangles]
    bvh = BVHTree.FromPolygons([Vector(c) for c in base_co], tris)
    tmp = ob.copy(); tmp.data = me.copy(); bpy.context.scene.collection.objects.link(tmp)
    if tmp.data.shape_keys:
        tmp.shape_key_clear()
    for m in list(tmp.modifiers): tmp.modifiers.remove(m)
    d = tmp.modifiers.new("Dec", 'DECIMATE'); d.ratio = ratio
    d.vertex_group = dense_group; d.invert_vertex_group = True; d.vertex_group_factor = 1.0
    d.use_symmetry = True; d.symmetry_axis = 'X'
    dg = bpy.context.evaluated_depsgraph_get()
    new = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    bpy.data.objects.remove(tmp, do_unlink=True)
    old = ob.data
    ob.data = new
    new.name = old.name
    bpy.data.meshes.remove(old)
    if keys:
        ob.shape_key_add(name="Basis")
        nv = len(new.vertices)
        maps = []
        for v in new.vertices:
            loc, nrm, ti, dist = bvh.find_nearest(v.co)
            maps.append((ti, loc, v.co - loc))
        for name, arr in keys[1:]:
            kb = ob.shape_key_add(name=name, from_mix=False)
            for vi, (ti, loc, off) in enumerate(maps):
                a, b, c = tris[ti]
                p = barycentric_transform(loc, Vector(base_co[a]), Vector(base_co[b]), Vector(base_co[c]),
                                          Vector(arr[a]), Vector(arr[b]), Vector(arr[c]))
                kb.data[vi].co = p + off
    for pg in new.polygons: pg.use_smooth = True
    if tracks:
        ad = new.shape_keys.animation_data_create()
        for name, strips in tracks:
            tr = ad.nla_tracks.new(); tr.name = name
            for sn, act, fs in strips:
                st = tr.strips.new(sn, int(fs), act)
                try:
                    if act.slots and st.action_slot is None: st.action_slot = act.slots[0]
                except Exception: pass
    return ob

# ------------------------------------------------------------------ hair shells (alpha cards that follow the morphs)
def add_hair_shells(ob, alpha_img, mat_index, offsets=(0.0010, 0.0022), thresh=0.06):
    me = ob.data
    w, h = alpha_img.size
    px = np.array(alpha_img.pixels[:]).reshape(h, w, 4)[:, :, 0]
    uv = me.uv_layers["UVMap"].data
    sel = []
    for pg in me.polygons:
        if pg.material_index != 0: continue
        vals = []
        for li in pg.loop_indices:
            u, v = uv[li].uv
            vals.append(px[min(h - 1, max(0, int(v * h))), min(w - 1, max(0, int(u * w)))])
        cu = sum(uv[li].uv for li in pg.loop_indices) / len(pg.loop_indices) if False else None
        if max(vals) > thresh:
            sel.append(pg.index)
    bmh = bmesh.new(); bmh.from_mesh(me)
    bmh.faces.ensure_lookup_table(); bmh.normal_update()
    layers = list(bmh.verts.layers.shape.values())
    created = 0
    for off in offsets:
        faces = [bmh.faces[i] for i in sel]
        ret = bmesh.ops.duplicate(bmh, geom=faces)
        nverts = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMVert)]
        bmh.normal_update()
        for nv in nverts:
            n = nv.normal.copy()
            nv.co += n * off
            for L in layers:
                nv[L] = nv[L] + n * off
        for f in ret["geom"]:
            if isinstance(f, bmesh.types.BMFace):
                f.material_index = mat_index; created += 1
        bmh.faces.ensure_lookup_table()
    bmh.to_mesh(me); bmh.free(); me.update()
    return created

# ------------------------------------------------------------------ eyes as skinned web meshes + eye bones
def add_eye_bones(rig, info):
    with ctx(rig):
        bpy.ops.object.mode_set(mode='EDIT')
        eb = rig.data.edit_bones
        for side, c in (("l", info["eye_l"]), ("r", info["eye_r"])):
            b = eb.new("eye_" + side)
            b.head = c; b.tail = c + Vector((0, -0.024, 0)); b.roll = 0
            b.parent = eb["head"]; b.use_deform = True
        bpy.ops.object.mode_set(mode='OBJECT')

def eye_meshes(info, rig, coll, size=512):
    """One eyeball baked at the origin (shader is in object space), then instanced twice into a skinned EYES mesh."""
    em, cm = eye_material()
    r = (info["eye_r_size"].x + info["eye_r_size"].z) / 4.0 * 0.98
    bmh = bmesh.new(); bmh.loops.layers.uv.new("UVMap")
    bmesh.ops.create_uvsphere(bmh, u_segments=24, v_segments=14, radius=r, calc_uvs=True)
    bmesh.ops.rotate(bmh, verts=bmh.verts, matrix=Matrix.Rotation(math.radians(90), 3, 'X'))
    proto = bpy.data.meshes.new("EYE_proto"); bmh.to_mesh(proto); bmh.free()
    proto.materials.append(em)
    po = bpy.data.objects.new("EYE_proto", proto); coll.objects.link(po)
    setup_cycles(1)
    img = new_img("eye_albedo", size)
    bake([po], 'DIFFUSE', img, pass_filter={'COLOR'})
    save_img(img, "eyes")
    def instanced(src_me, name, centers):
        bmh = bmesh.new()
        for c in centers:
            tmp = bmesh.new(); tmp.from_mesh(src_me)
            bmesh.ops.translate(tmp, verts=tmp.verts, vec=c)
            t = bpy.data.meshes.new("tmp"); tmp.to_mesh(t); tmp.free()
            bmh.from_mesh(t); bpy.data.meshes.remove(t)
        me = bpy.data.meshes.new(name); bmh.to_mesh(me); bmh.free()
        for pg in me.polygons: pg.use_smooth = True
        return me
    centers = [info["eye_l"], info["eye_r"]]
    me = instanced(proto, "EYES", centers)
    me.materials.clear(); me.materials.append(gltf_mat("eye", base_img=img, rough=0.2, coat=0.5, coat_rough=0.03))
    eyes = bpy.data.objects.new("EYES", me); coll.objects.link(eyes)
    # cornea caps (front dome only)
    bmh = bmesh.new(); bmh.loops.layers.uv.new("UVMap")
    bmesh.ops.create_uvsphere(bmh, u_segments=20, v_segments=14, radius=r * 1.012, calc_uvs=True)
    bmesh.ops.rotate(bmh, verts=bmh.verts, matrix=Matrix.Rotation(math.radians(90), 3, 'X'))
    for v in bmh.verts:
        a = math.acos(max(-1, min(1, -v.co.y / v.co.length)))
        if a < 0.62: v.co += Vector((0, -1, 0)) * (0.0022 * math.cos(a / 0.62 * math.pi / 2) ** 2)
    bmesh.ops.delete(bmh, geom=[v for v in bmh.verts if math.acos(max(-1, min(1, -v.co.y / v.co.length))) > 0.95], context='VERTS')
    cp = bpy.data.meshes.new("CORNEA_proto"); bmh.to_mesh(cp); bmh.free()
    me2 = instanced(cp, "CORNEA", centers)
    me2.materials.append(gltf_mat("cornea", base_col=(0.0, 0.0, 0.0, 1), rough=0.0, alpha=0.12))
    cor = bpy.data.objects.new("CORNEA", me2); coll.objects.link(cor)
    for o in (eyes, cor):
        for side, c in zip(("l", "r"), centers):
            vg = o.vertex_groups.new(name="eye_" + side)
            vg.add([v.index for v in o.data.vertices if (v.co - c).length < r * 1.6], 1.0, 'REPLACE')
        a = o.modifiers.new("Armature", 'ARMATURE'); a.object = rig
        o.parent = rig
    bpy.data.objects.remove(po, do_unlink=True)
    bpy.data.meshes.remove(proto); bpy.data.meshes.remove(cp)
    return eyes, cor, img

# ------------------------------------------------------------------ outfit atlas
def smart_uv(ob, margin=0.004):
    vl = bpy.context.view_layer
    for o in vl.objects: o.select_set(False)
    ob.select_set(True); vl.objects.active = ob
    if not ob.data.uv_layers: ob.data.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=margin, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')

def join(objs, name):
    main = objs[0]
    with bpy.context.temp_override(object=main, active_object=main, selected_objects=objs, selected_editable_objects=objs):
        bpy.ops.object.join()
    main.name = name; main.data.name = name
    return main

def rigid_to_bone(ob, rig, bone):
    """Turn a bone-parented rigid object into skinned geometry weighted 100% to `bone`."""
    mw = ob.matrix_world.copy()
    ob.parent = None; ob.matrix_world = mw
    upd()
    with ctx(ob):
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    vg = ob.vertex_groups.new(name=bone)
    vg.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')
    for m in list(ob.modifiers):
        if m.type != 'ARMATURE':
            apply_mod(ob, m.name)
    a = ob.modifiers.new("Armature", 'ARMATURE'); a.object = rig

def bake_set(obs, role, prefix, size, normal=True, rough=True):
    setup_cycles(4)
    out = {}
    img = new_img(f"{prefix}_albedo", size); bake(obs, 'DIFFUSE', img, pass_filter={'COLOR'}); out["albedo"] = save_img(img, role)
    if rough:
        img = new_img(f"{prefix}_rough", max(256, size // 2), non_color=True); bake(obs, 'ROUGHNESS', img); out["rough"] = save_img(img, role)
    if normal:
        img = new_img(f"{prefix}_normal", size, non_color=True); bake(obs, 'NORMAL', img); out["normal"] = save_img(img, role)
    return out

def bake_prop(ob, role, size=256, rough=0.6, metal=0.0, normal=False):
    if not ob.data.uv_layers:
        smart_uv(ob)
    for m in list(ob.modifiers):
        apply_mod(ob, m.name)
    t = bake_set([ob], role, ob.name.lower(), size, normal=normal, rough=False)
    ob.data.materials.clear()
    ob.data.materials.append(gltf_mat(ob.name.lower(), base_img=t["albedo"], rough=rough, metal=metal,
                                      normal_img=t.get("normal")))


def hull_fit(ob, offset=0.004, it=8):
    """Boots: project the foot shell onto each foot's convex hull (no toes), then round it off."""
    me = ob.data
    for sgn in (1, -1):
        ids = [v.index for v in me.vertices if v.co.x * sgn > 0]
        if len(ids) < 8: continue
        hb = bmesh.new()
        for i in ids: hb.verts.new(me.vertices[i].co)
        bmesh.ops.convex_hull(hb, input=hb.verts[:])
        bmesh.ops.delete(hb, geom=[v for v in hb.verts if not v.link_faces], context='VERTS')
        hb.normal_update()
        cen = sum((v.co for v in hb.verts), Vector()) / len(hb.verts)
        bvh = BVHTree.FromBMesh(hb)
        idset = set(ids)
        nb_ = {i: [] for i in ids}
        for e in me.edges:
            a, b = e.vertices
            if a in idset and b in idset: nb_[a].append(b); nb_[b].append(a)
        bnd = set()
        for e in me.edges:
            pass
        def proj(p):
            loc, n, fi, d = bvh.find_nearest(p)
            if loc is None: return p
            if (loc - cen).dot(n) < 0: n = -n
            return loc + n * offset
        for i in ids:
            me.vertices[i].co = proj(me.vertices[i].co)
        # relax on the hull surface so the collapsed toe area unfolds
        for _ in range(25):
            newp = {}
            for i in ids:
                if len(nb_[i]) < 3: continue
                avg = sum((me.vertices[j].co for j in nb_[i]), Vector()) / len(nb_[i])
                newp[i] = proj(me.vertices[i].co.lerp(avg, 0.6))
            for i, p in newp.items(): me.vertices[i].co = p
        hb.free()
    bmh = bmesh.new(); bmh.from_mesh(me)
    vsmooth(bmh, [v for v in bmh.verts if not v.is_boundary], it)
    bmh.to_mesh(me); bmh.free(); me.update()

def warm_albedo(img, sat=1.22, warm=(1.05, 1.0, 0.93)):
    px = np.array(img.pixels[:]).reshape(-1, 4)
    rgb = px[:, :3]
    lum = (rgb @ np.array([0.2126, 0.7152, 0.0722]))[:, None]
    rgb = np.clip((lum + (rgb - lum) * sat) * np.array(warm), 0, 1)
    px[:, :3] = rgb
    img.pixels = px.ravel().tolist()

def loosen_trousers(ob, rig, belt_z, r_top=0.100, r_bot=0.084, ease=0.004):
    """Straight-leg work trousers: legs pushed onto a straight cone (no shrink-wrap), seat filled to its convex hull."""
    me = ob.data
    B = rig.data.bones
    crotch = B["thigh_l"].head_local.z - 0.075
    for s, sg in (("_l", 1), ("_r", -1)):
        top = B["thigh" + s].head_local.copy(); bot = B["foot" + s].head_local.copy()
        top.x += 0.012 * sg
        for v in me.vertices:
            if v.co.x * sg <= 0 or v.co.z > crotch + 0.02: continue
            t = max(0.0, min(1.0, (top.z - v.co.z) / (top.z - bot.z)))
            ax = top.lerp(bot, t)
            d = Vector((v.co.x - ax.x, v.co.y - ax.y, 0)); r = d.length
            if r < 1e-5: continue
            tz = max(0.0, min(1.0, (crotch - v.co.z) / (crotch - bot.z)))
            rt = r_top + (r_bot - r_top) * tz
            w = min(1.0, (crotch + 0.02 - v.co.z) / 0.06)
            # inner thigh: don't push across the midline
            nr = max(r + ease, rt)
            if sg * (v.co.x - ax.x) < 0: nr = min(nr, abs(v.co.x - ax.x) / max(1e-4, abs(d.x) / r) * 0.95 if abs(d.x) > 1e-4 else nr)
            nr = r + (nr - r) * w
            p = d.normalized() * nr
            v.co.x, v.co.y = ax.x + p.x, ax.y + p.y
    band = [v.index for v in me.vertices if crotch - 0.05 < v.co.z < belt_z + 0.01]
    hb = bmesh.new()
    for i in band: hb.verts.new(me.vertices[i].co)
    bmesh.ops.convex_hull(hb, input=hb.verts[:])
    bmesh.ops.delete(hb, geom=[v for v in hb.verts if not v.link_faces], context='VERTS')
    bmesh.ops.recalc_face_normals(hb, faces=hb.faces[:])
    bvh = BVHTree.FromBMesh(hb)
    for i in band:
        v = me.vertices[i]
        loc, n, fi, dist = bvh.find_nearest(v.co)
        if loc is None: continue
        w = min(1.0, (v.co.z - (crotch - 0.05)) / 0.05)
        if v.co.y > 0:      # seat: fill the cleft, flatten the buttocks a little
            v.co = v.co.lerp(loc + n * 0.003, w)
        else:
            v.co = v.co.lerp(loc, 0.4 * w)
    hb.free()
    bmh = bmesh.new(); bmh.from_mesh(me)
    vsmooth(bmh, [v for v in bmh.verts if not v.is_boundary], 14)
    bnd = [v for v in bmh.verts if v.is_boundary]
    for _ in range(6):
        np_ = {}
        for v in bnd:
            nb2 = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nb2) == 2: np_[v] = v.co * 0.4 + (nb2[0].co + nb2[1].co) * 0.3
        for v, c in np_.items(): v.co = c
    bmh.to_mesh(me); bmh.free(); me.update()

def trousers_material(name, hex_, belt_z, knee_z, dust=0.15):
    m = bpy.data.materials.new(name); nb = NB(m)
    P = nb.metric()
    sep = nb.n("ShaderNodeSeparateXYZ"); nb.l(P, sep.inputs[0])
    X, Y, Z = sep.outputs[0], sep.outputs[1], sep.outputs[2]
    ax = nb.math('ABSOLUTE', X)
    tw = nb.n("ShaderNodeTexWave", wave_type='BANDS', bands_direction='DIAGONAL'); nb.l(P, tw.inputs["Vector"]); tw.inputs["Scale"].default_value = 900.0
    c = nb.mixc('MULTIPLY', nb.maprange(tw.outputs["Fac"], 0, 1, 0.0, 0.10), srgb(hex_), (0.7, 0.7, 0.7, 1))
    c = nb.mixc('MULTIPLY', nb.maprange(nb.noise(P, 4.0, 5.0, 0.6), 0.4, 0.7, 0.0, 0.18), c, (0.8, 0.78, 0.74, 1))
    # back patch pockets
    back = nb.maprange(Y, 0.03, 0.05)
    inx = nb.math('MULTIPLY', nb.maprange(ax, 0.035, 0.037), nb.maprange(ax, 0.130, 0.128))
    inz = nb.math('MULTIPLY', nb.maprange(Z, belt_z - 0.165, belt_z - 0.163), nb.maprange(Z, belt_z - 0.045, belt_z - 0.047))
    pk = nb.math('MULTIPLY', nb.math('MULTIPLY', inx, inz), back)
    inn = nb.math('MULTIPLY', nb.math('MULTIPLY', nb.maprange(ax, 0.039, 0.041), nb.maprange(ax, 0.126, 0.124)),
                  nb.math('MULTIPLY', nb.maprange(Z, belt_z - 0.161, belt_z - 0.159), nb.maprange(Z, belt_z - 0.049, belt_z - 0.051)))
    seam = nb.math('MULTIPLY', pk, nb.math('SUBTRACT', 1.0, inn))
    # belt loops: short vertical tabs just below the belt line
    lx = nb.math('PINGPONG', nb.math('ADD', X, 0.0), 0.06)
    loop = nb.math('MULTIPLY', nb.maprange(nb.math('ABSOLUTE', nb.math('SUBTRACT', lx, 0.03)), 0.007, 0.005),
                   nb.math('MULTIPLY', nb.maprange(Z, belt_z - 0.045, belt_z - 0.040), nb.maprange(Z, belt_z + 0.01, belt_z + 0.005)))
    c = nb.mixc('MULTIPLY', nb.math('MULTIPLY', seam, 0.6), c, (0.5, 0.5, 0.52, 1))
    c = nb.mixc('MULTIPLY', nb.math('MULTIPLY', pk, 0.15), c, (0.85, 0.85, 0.85, 1))
    c = nb.mixc('MULTIPLY', nb.math('MULTIPLY', loop, 0.5), c, (0.6, 0.6, 0.6, 1))
    # dust on the shins (front, below the knee)
    sh = nb.math('MULTIPLY', nb.maprange(Z, knee_z, knee_z - 0.15), nb.maprange(Y, 0.0, -0.04))
    dm = nb.math('MULTIPLY', nb.math('MULTIPLY', sh, nb.maprange(nb.noise(P, 8.0, 5.0, 0.6), 0.35, 0.75)), dust)
    c = nb.mixc('MIX', dm, c, (0.42, 0.40, 0.36, 1))
    h = nb.math('ADD', nb.math('MULTIPLY', tw.outputs["Fac"], 0.4), nb.math('MULTIPLY', nb.noise(P, 35.0, 6.0, 0.6), 2.0))
    h = nb.math('SUBTRACT', h, nb.math('MULTIPLY', seam, 3.0)); h = nb.math('ADD', h, nb.math('MULTIPLY', loop, 2.0))
    bump = nb.n("ShaderNodeBump"); nb.l(h, bump.inputs["Height"])
    bump.inputs["Strength"].default_value = 0.35; bump.inputs["Distance"].default_value = 0.0006
    p = principled(nb, Base_Color=c, Roughness=nb.mixf(dm, 0.8, 0.9), Specular_IOR_Level=0.3)
    nb.l(bump.outputs[0], p.inputs["Normal"]); nb.out(p.outputs[0])
    return m
