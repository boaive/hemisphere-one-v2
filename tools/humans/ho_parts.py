"""HEMISPHERE ONE - eyes, hair, clothes, helmet, props, posing, QC rig."""
import bpy, bmesh, math, random
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree
from ho_common import *

# ================================================================ EYES
def eye_material(iris_hex="#2B1A10"):
    mat = bpy.data.materials.new("HO_eye")
    nb = NB(mat)
    tc = nb.n("ShaderNodeTexCoord")
    sep = nb.n("ShaderNodeSeparateXYZ"); nb.l(tc.outputs["Object"], sep.inputs[0])
    ln = nb.n("ShaderNodeVectorMath", operation='LENGTH'); nb.l(tc.outputs["Object"], ln.inputs[0])
    cosv = nb.math('DIVIDE', nb.math('MULTIPLY', sep.outputs[1], -1.0), ln.outputs["Value"])
    ang = nb.math('ARCCOSINE', nb.math('MINIMUM', nb.math('MAXIMUM', cosv, -1.0), 1.0))
    az = nb.math('ARCTAN2', sep.outputs[2], sep.outputs[0])
    cmb = nb.n("ShaderNodeCombineXYZ")
    nb.l(nb.math('MULTIPLY', az, 9.0), cmb.inputs[0]); nb.l(nb.math('MULTIPLY', ang, 60.0), cmb.inputs[1])
    streak = nb.noise(cmb.outputs[0], 1.6, 6.0, 0.6, dim='3D')
    iris_base = srgb(iris_hex)
    ic = nb.mixc('MULTIPLY', 1.0, iris_base, (1, 1, 1, 1))
    ic = nb.mixc('MIX', nb.maprange(streak, 0.35, 0.75), (0.010, 0.005, 0.003, 1), (0.085, 0.045, 0.018, 1))
    # collarette: lighter ring mid-iris
    ring = nb.math('MULTIPLY', nb.maprange(ang, 0.17, 0.24), nb.maprange(ang, 0.32, 0.26))
    ic = nb.mixc('MIX', nb.math('MULTIPLY', ring, 0.5), ic, (0.12, 0.065, 0.025, 1))
    limbal = nb.maprange(ang, 0.40, 0.50)
    ic = nb.mixc('MIX', nb.math('MULTIPLY', limbal, 0.85), ic, (0.006, 0.004, 0.003, 1))
    pupil = nb.maprange(ang, 0.165, 0.145)
    ic = nb.mixc('MIX', pupil, ic, (0.0015, 0.0012, 0.001, 1))
    # sclera: warm off-white, darker toward the back, faint veins
    veins = nb.maprange(nb.noise(tc.outputs["Object"], 700.0, 8.0, 0.7, dist=2.0), 0.62, 0.7)
    sc = nb.mixc('MIX', nb.math('MULTIPLY', veins, nb.maprange(ang, 0.9, 1.4, 0.0, 0.6)), (0.37, 0.32, 0.27, 1), (0.36, 0.11, 0.08, 1))
    sc = nb.mixc('MULTIPLY', nb.maprange(ang, 0.8, 1.5), sc, (0.45, 0.40, 0.38, 1))
    iris_m = nb.maprange(ang, 0.53, 0.50)
    col = nb.mixc('MIX', iris_m, sc, ic)
    p = principled(nb, Base_Color=col, Roughness=0.35, Specular_IOR_Level=0.3,
                   Subsurface_Weight=0.15, Subsurface_Radius=(1.0, 0.3, 0.2), Subsurface_Scale=0.002)
    nb.out(p.outputs[0])
    # cornea / tear film
    cm = bpy.data.materials.new("HO_cornea")
    nb = NB(cm)
    fr = nb.n("ShaderNodeFresnel"); fr.inputs["IOR"].default_value = 1.376
    tr = nb.n("ShaderNodeBsdfTransparent")
    gl = nb.n("ShaderNodeBsdfGlossy"); gl.inputs["Roughness"].default_value = 0.015
    mx = nb.n("ShaderNodeMixShader")
    nb.l(fr.outputs[0], mx.inputs[0]); nb.l(tr.outputs[0], mx.inputs[1]); nb.l(gl.outputs[0], mx.inputs[2])
    nb.out(mx.outputs[0])
    try:
        cm.surface_render_method = 'DITHERED'
    except Exception: pass
    return mat, cm

def make_eyes(info, rig, coll, target):
    em, cm = eye_material()
    eyes = []
    for side, c in (("L", info["eye_l"]), ("R", info["eye_r"])):
        r = (info["eye_r_size"].x + info["eye_r_size"].z) / 4.0 * 0.98
        bmh = bmesh.new()
        bmesh.ops.create_uvsphere(bmh, u_segments=48, v_segments=32, radius=r)
        bmesh.ops.rotate(bmh, verts=bmh.verts, matrix=Matrix.Rotation(math.radians(90), 3, 'X'))
        me = bpy.data.meshes.new("EYE_" + side); bmh.to_mesh(me); bmh.free()
        for pg in me.polygons: pg.use_smooth = True
        me.materials.append(em)
        o = bpy.data.objects.new("EYE_" + side, me); coll.objects.link(o)
        o.location = c
        # cornea: slightly larger shell with a bulged front dome
        bmh = bmesh.new()
        bmesh.ops.create_uvsphere(bmh, u_segments=48, v_segments=32, radius=r * 1.012)
        bmesh.ops.rotate(bmh, verts=bmh.verts, matrix=Matrix.Rotation(math.radians(90), 3, 'X'))
        for v in bmh.verts:
            a = math.acos(max(-1, min(1, -v.co.y / v.co.length)))
            if a < 0.62:
                v.co += Vector((0, -1, 0)) * (0.0024 * math.cos(a / 0.62 * math.pi / 2) ** 2)
        me2 = bpy.data.meshes.new("CORNEA_" + side); bmh.to_mesh(me2); bmh.free()
        for pg in me2.polygons: pg.use_smooth = True
        me2.materials.append(cm)
        o2 = bpy.data.objects.new("CORNEA_" + side, me2); coll.objects.link(o2)
        o2.parent = o
        upd()
        for ob in (o,):
            mw = ob.matrix_world.copy()
            ob.parent = rig; ob.parent_type = 'BONE'; ob.parent_bone = "head"
            upd(); ob.matrix_world = mw
        dt = o.constraints.new('DAMPED_TRACK'); dt.target = target; dt.track_axis = 'TRACK_NEGATIVE_Y'; dt.influence = 0.6
        eyes.append(o)
    return eyes

def setup_helpers_visibility(bm, extra_groups, hidden_skin, mats):
    """Single mask: visible body skin + chosen helper parts (teeth, tongue, lashes)."""
    me = bm.data
    body = vg_set(bm, "body")
    keep = (body - hidden_skin)
    for g in extra_groups: keep |= vg_set(bm, g)
    vg = bm.vertex_groups.get("HO_visible") or bm.vertex_groups.new(name="HO_visible")
    vg.add(list(keep), 1.0, 'REPLACE')
    for m in bm.modifiers:
        if m.type == 'MASK':
            m.vertex_group = "HO_visible"; m.invert_vertex_group = False
    # material slots: 0 skin, then helper materials
    me.materials.clear()
    for m in mats.values(): pass
    me.materials.append(mats["skin"])
    slot = {"skin": 0}
    for k in ("teeth", "tongue", "lashes"):
        me.materials.append(mats[k]); slot[k] = len(me.materials) - 1
    teeth = vg_set(bm, "helper-upper-teeth") | vg_set(bm, "helper-lower-teeth")
    tongue = vg_set(bm, "helper-tongue")
    lashes = set()
    for g in ("helper-l-eyelashes-1", "helper-l-eyelashes-2", "helper-r-eyelashes-1", "helper-r-eyelashes-2"):
        lashes |= vg_set(bm, g)
    for pg in me.polygons:
        vs = set(pg.vertices)
        pg.material_index = slot["teeth"] if vs <= teeth else slot["tongue"] if vs <= tongue else slot["lashes"] if vs <= lashes else 0
        pg.use_smooth = True

def simple_mat(name, col, rough=0.5, sss=0.0, metal=0.0, alpha=None):
    m = bpy.data.materials.new(name)
    nb = NB(m)
    p = principled(nb, Base_Color=col, Roughness=rough, Metallic=metal)
    if sss:
        p.inputs["Subsurface Weight"].default_value = sss
        p.inputs["Subsurface Scale"].default_value = 0.002
    nb.out(p.outputs[0])
    return m

# ================================================================ HAIR CURVES
def _tri_sampler(bm, faces_filter, allowed=None):
    me = bm.data
    me.calc_loop_triangles()
    uv = me.uv_layers["UVMap"].data
    tris = []
    for t in me.loop_triangles:
        if allowed is not None and not all(i in allowed for i in t.vertices):
            continue
        vs = [me.vertices[i].co for i in t.vertices]
        c = (vs[0] + vs[1] + vs[2]) / 3
        nrm = t.normal
        w = faces_filter(c, nrm)
        if w > 0:
            tris.append((t, vs, [uv[l].uv.copy() for l in t.loops], w * t.area, nrm.copy()))
    return tris

def add_hair(bm, name, coll, regions, mat, seed=1, allowed=None, radius=0.000038):
    """regions: list of (filter(c,n)->density weight, count, direction(c,n)->Vector, length(c)->m, lift)"""
    rnd = random.Random(seed)
    roots, uvs, strands = [], [], []
    for flt, count, dirf, lenf, lift in regions:
        tris = _tri_sampler(bm, flt, allowed)
        if not tris: continue
        tot = sum(t[3] for t in tris)
        cum = []; s = 0
        for t in tris: s += t[3]; cum.append(s)
        import bisect
        for _ in range(count):
            k = bisect.bisect_left(cum, rnd.random() * tot)
            t, vs, tuv, _, nrm = tris[min(k, len(tris) - 1)]
            a, b = rnd.random(), rnd.random()
            if a + b > 1: a, b = 1 - a, 1 - b
            p = vs[0] + (vs[1] - vs[0]) * a + (vs[2] - vs[0]) * b
            uvp = tuv[0] + (tuv[1] - tuv[0]) * a + (tuv[2] - tuv[0]) * b
            d = dirf(p, nrm)
            d = (d - nrm * d.dot(nrm)).normalized()
            L = lenf(p) * (0.75 + 0.5 * rnd.random())
            jitter = Vector((rnd.gauss(0, 0.13), rnd.gauss(0, 0.13), rnd.gauss(0, 0.13)))
            d = (d + (jitter - nrm * jitter.dot(nrm))).normalized()
            pts = []
            for i in range(4):
                f = i / 3
                # leaves the skin at `lift`, then lies down toward the skin
                pts.append(p + d * L * f + nrm * (L * lift * math.sin(f * math.pi * 0.8)) + nrm * 0.0002)
            strands.append(pts); uvs.append(uvp)
    cd = bpy.data.hair_curves.new(name)
    cd.add_curves([4] * len(strands))
    flat = [c for s in strands for p in s for c in p]
    cd.attributes["position"].data.foreach_set("vector", flat)
    rad = cd.attributes.get("radius") or cd.attributes.new("radius", 'FLOAT', 'POINT')
    rv = []
    for s in strands: rv += [radius, radius * 0.85, radius * 0.62, radius * 0.3]
    rad.data.foreach_set("value", rv)
    su = cd.attributes.new("surface_uv_coordinate", 'FLOAT2', 'CURVE')
    su.data.foreach_set("vector", [c for u in uvs for c in u])
    cd.surface = bm
    cd.surface_uv_map = "UVMap"
    cd.materials.append(mat)
    ob = bpy.data.objects.new(name, cd); coll.objects.link(ob)
    ob.parent = bm
    # deform with the body (armature + shape keys) via Deform Curves on Surface
    ng = bpy.data.node_groups.get("HO_deform_on_surface")
    if not ng:
        ng = bpy.data.node_groups.new("HO_deform_on_surface", 'GeometryNodeTree')
        ng.interface.new_socket("Geometry", in_out='INPUT', socket_type='NodeSocketGeometry')
        ng.interface.new_socket("Geometry", in_out='OUTPUT', socket_type='NodeSocketGeometry')
        gi = ng.nodes.new("NodeGroupInput"); go = ng.nodes.new("NodeGroupOutput")
        dn = ng.nodes.new("GeometryNodeDeformCurvesOnSurface")
        ng.links.new(gi.outputs[0], dn.inputs[0]); ng.links.new(dn.outputs[0], go.inputs[0])
    md = ob.modifiers.new("DeformOnSurface", 'NODES'); md.node_group = ng
    return ob

def hair_material(name, col, grey=0.0):
    m = bpy.data.materials.new(name)
    nb = NB(m)
    hi = nb.n("ShaderNodeHairInfo")
    c = nb.mixc('MIX', nb.math('GREATER_THAN', hi.outputs["Random"], 1.0 - grey), col, (0.42, 0.40, 0.38, 1))
    c = nb.mixc('MULTIPLY', nb.maprange(hi.outputs["Intercept"], 0.0, 1.0, 0.8, 1.15), c, (1, 1, 1, 1)) if False else c
    p = principled(nb, Base_Color=c, Roughness=0.38, Specular_IOR_Level=0.5, Coat_Weight=0.0)
    nb.out(p.outputs[0])
    return m

def face_hair(bm, coll, info, moustache=True, brow_len=0.008, grey=0.0, seed=3):
    El, Er = info["eye_l"], info["eye_r"]
    M = info["mouth"]; lip_top = info["lip_top"]
    regs = []
    def brow_filter(E, sgn):
        def f(c, n):
            if n.y > -0.25: return 0
            dx = (c.x - E.x) * sgn   # + outward
            if dx < -0.020 or dx > 0.027: return 0
            u = (dx + 0.020) / 0.047                       # 0 inner .. 1 tail
            zc = E.z + 0.0125 + 0.0065 * math.sin(min(1.0, u * 1.35) * math.pi * 0.85) - 0.004 * max(0, u - 0.7) / 0.3
            half = 0.0042 * (1 - u) + 0.0018 * u
            dz = abs(c.z - zc)
            if dz > half: return 0
            return (1.4 - 0.7 * u)
        return f
    def brow_dir(E, sgn):
        def d(c, n):
            dx = (c.x - E.x) * sgn
            u = (dx + 0.020) / 0.047
            up = max(0.0, 1.0 - u * 2.2)
            return Vector((sgn * (0.4 + 1.0 * u), 0, up * 1.2 + 0.15 - 0.35 * u))
        return d
    for E, sgn in ((El, 1), (Er, -1)):
        regs.append((brow_filter(E, sgn), 430, brow_dir(E, sgn), lambda c: brow_len, 0.2))
    if moustache:
        def mf(c, n):
            if n.y > -0.2: return 0
            ax = abs(c.x)
            if ax > 0.030: return 0
            ztop = lip_top + 0.0155 - 0.008 * (ax / 0.030) ** 2
            zbot = lip_top + 0.0005 - 0.006 * (ax / 0.030) ** 2
            if not (zbot < c.z < ztop): return 0
            if ax < 0.0035 and c.z > lip_top + 0.006: return 0.4   # philtrum thinner
            return 1.0
        def md(c, n):
            return Vector((0.45 * (1 if c.x > 0 else -1) * min(1, abs(c.x) / 0.02), 0, -1.0))
        regs.append((mf, 1500, md, lambda c: 0.0062, 0.06))
    mat = hair_material("HO_facehair", (0.018, 0.012, 0.009, 1), grey=grey)
    allowed = vg_set(bm, "body")
    fh = add_hair(bm, "FACE_HAIR", coll, regs, mat, seed, allowed=allowed)
    # eyelashes: roots on the visible lid margin next to MakeHuman's lash helper strips
    from mathutils.kdtree import KDTree
    lregs = []
    r_eye = (info["eye_r_size"].x + info["eye_r_size"].z) / 4.0
    for E, side in ((El, "l"), (Er, "r")):
        hv = vg_set(bm, f"helper-{side}-eyelashes-1") | vg_set(bm, f"helper-{side}-eyelashes-2")
        kd = KDTree(len(hv))
        for k, i in enumerate(hv): kd.insert(bm.data.vertices[i].co, k)
        kd.balance()
        for upper in (True, False):
            def lf(c, n, E=E, kd=kd, upper=upper):
                if (c.z > E.z) != upper: return 0
                if c.y > E.y - r_eye * 0.25: return 0
                if kd.find(c)[2] > 0.0013: return 0
                if abs((c - E).length - r_eye) > 0.0045: return 0
                return 1.0
            def ld(c, n, E=E, upper=upper):
                rad = (c - E); rad.y = 0; rad = rad.normalized() if rad.length > 1e-6 else Vector((0, 0, 1))
                return (Vector((0, -0.9, 0)) + Vector((0, 0, 0.75 if upper else -0.6)) + rad * 0.25).normalized()
            lregs.append((lf, 75 if upper else 22, ld, (lambda c: 0.0068) if upper else (lambda c: 0.0035), 0.5))
    lm = hair_material("HO_lashes_hair", (0.008, 0.006, 0.005, 1))
    add_hair(bm, "EYELASHES", coll, lregs, lm, seed + 7, allowed=allowed, radius=0.00003)
    return fh

# ================================================================ CLOTHES (shells grown from the body)
def vsmooth(bmh, verts, it, lam=0.5, mu=-0.53):
    """Taubin lambda/mu smoothing: removes anatomy detail without shrinking the garment."""
    vs = list(verts)
    nbrs = [[e.other_vert(v) for e in v.link_edges] for v in vs]
    for _ in range(it):
        for f in (lam, mu):
            new = []
            for v, nb_ in zip(vs, nbrs):
                if not nb_: new.append(v.co.copy()); continue
                avg = sum((n.co for n in nb_), Vector()) / len(nb_)
                new.append(v.co + (avg - v.co) * f)
            for v, c in zip(vs, new): v.co = c

TORSO = {"spine_01", "spine_02", "spine_03", "clavicle_l", "clavicle_r", "pelvis"}
def classify(bm, rig, cfg):
    me = bm.data
    body = vg_set(bm, "body")
    dom = dominant_bones(bm, rig)
    B = rig.data.bones
    belt_z = B["spine_01"].head_local.z - 0.01
    clav_z = B["clavicle_l"].head_local.z
    ankle_z = B["foot_l"].head_local.z
    regions = {k: set() for k in ("shirt", "trousers", "boots")}
    def t_along(bn, p):
        b = B[bn]; a = b.head_local; v = b.tail_local - a
        return (p - a).dot(v) / v.length_squared
    for i in body:
        p = me.vertices[i].co; d = dom[i]
        if d is None: continue
        side = "_l" if p.x > 0 else "_r"
        # shirt / vest
        top = False
        if d in TORSO or d in ("upperarm_l", "upperarm_r", "lowerarm_l", "lowerarm_r", "neck_01"):
            ok = p.z > belt_z - cfg["tuck"]
            if d == "neck_01":
                ok = ok and p.z < clav_z + (0.005 if p.y > -0.02 else -0.02)
            if d in ("lowerarm_l", "lowerarm_r"):
                ok = ok and t_along(d, p) < cfg["sleeve_t"]
            if d in ("upperarm_l", "upperarm_r") and cfg["sleeveless"]:
                ok = False
            if cfg["sleeveless"] and d in TORSO:
                # deep armholes + scoop neck for a cotton banian
                ax = abs(p.x)
                arm_hole = ax > cfg["strap_x"] and p.z > B["upperarm_l"].head_local.z - 0.10
                scoop = p.y < -0.04 and ax < 0.075 and p.z > clav_z - 0.085 + (ax / 0.075) ** 2 * 0.07
                back = p.y > 0.02 and ax < 0.07 and p.z > clav_z - 0.03
                ok = ok and not arm_hole and not scoop and not back
            if d == "pelvis" and p.z < belt_z - cfg["tuck"]: ok = False
            vd = cfg.get("vneck", 0.0)
            if vd and p.y < -0.02 and p.z > clav_z - vd and abs(p.x) < 0.04 * (p.z - (clav_z - vd)) / vd:
                ok = False
            if ok: regions["shirt"].add(i); top = True
        # trousers
        if d in ("pelvis", "thigh_l", "thigh_r", "calf_l", "calf_r", "spine_01"):
            if p.z < belt_z + 0.004 and p.z > ankle_z + cfg["hem"]:
                regions["trousers"].add(i)
        # boots
        if d in ("foot_l", "foot_r", "ball_l", "ball_r") or (d in ("calf_l", "calf_r") and p.z < ankle_z + cfg["boot_h"]):
            regions["boots"].add(i)
    return regions, belt_z, clav_z

def shell(bm, rig, idx, name, coll, offset, smooth_iter, mat, solid=0.002, extra_offset=None, min_gap=0.003, subdiv=1, post_smooth=0, drape=None, hidden=None):
    """Duplicate the body region, smooth away anatomy, push outward, keep bone weights."""
    me = bm.data
    new = me.copy(); new.name = name
    if new.shape_keys:
        pass
    ob = bpy.data.objects.new(name, new); coll.objects.link(ob)
    ob.matrix_world = bm.matrix_world
    if ob.data.shape_keys:
        ob.shape_key_clear()
    bmh = bmesh.new(); bmh.from_mesh(new)
    bmh.verts.ensure_lookup_table()
    keep = set(idx)
    kill = [v for v in bmh.verts if v.index not in keep]
    bmesh.ops.delete(bmh, geom=kill, context='VERTS')
    loose = [v for v in bmh.verts if not v.link_faces]
    bmesh.ops.delete(bmh, geom=loose, context='VERTS')
    inner = [v for v in bmh.verts if not v.is_boundary]
    bmh.normal_update()
    for v in bmh.verts:
        o = offset if extra_offset is None else offset + extra_offset(v.co)
        v.co += v.normal * o
    vsmooth(bmh, inner, smooth_iter)
    # relax boundary loops too (straight hems)
    bnd = [v for v in bmh.verts if v.is_boundary]
    for _ in range(4):
        newpos = {}
        for v in bnd:
            nb_ = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nb_) == 2:
                newpos[v] = v.co * 0.5 + (nb_[0].co + nb_[1].co) * 0.25
        for v, c in newpos.items(): v.co = c
    bmh.to_mesh(new); bmh.free()
    # push out anything still inside/too close to the body
    dg = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(bm, dg, deform=False) if False else None
    bb = bmesh.new(); bb.from_mesh(me)
    bb.verts.ensure_lookup_table()
    body_ids = vg_set(bm, "body") - (hidden or set())
    rem = [v for v in bb.verts if v.index not in body_ids]
    bmesh.ops.delete(bb, geom=rem, context='VERTS')
    bvh = BVHTree.FromBMesh(bb)
    fb = bmesh.new(); fb.from_mesh(me); fb.verts.ensure_lookup_table()
    allb = vg_set(bm, "body")
    bmesh.ops.delete(fb, geom=[v for v in fb.verts if v.index not in allb], context='VERTS')
    fbvh = BVHTree.FromBMesh(fb)
    def push(passes=3):
        for _ in range(passes):
            for v in new.vertices:
                hit, nrm, _, d = bvh.find_nearest(v.co)
                if hit is not None and (v.co - hit).dot(nrm) < min_gap and d < 0.03:
                    v.co = hit + nrm * min_gap
                hit, nrm, _, d = fbvh.find_nearest(v.co)
                if hit is not None and (v.co - hit).dot(nrm) < -0.002:
                    v.co = hit + nrm * 0.001
    push()
    if post_smooth:
        bmh = bmesh.new(); bmh.from_mesh(new)
        inner = [v for v in bmh.verts if not v.is_boundary]
        if drape:
            drape(bmh)
        vsmooth(bmh, inner, post_smooth)
        bmh.to_mesh(new); bmh.free()
        push(2)
    bb.free(); fb.free()
    for m in list(ob.modifiers): ob.modifiers.remove(m)
    new.materials.clear(); new.materials.append(mat)
    for pg in new.polygons: pg.use_smooth = True
    return ob

def finish_shell(ob, rig, solid=0.002, subdiv=1, wrinkle=0.0025, wrinkle_scale=0.05):
    if wrinkle > 0:
        tex = bpy.data.textures.new(ob.name + "_wr", 'CLOUDS')
        tex.noise_scale = wrinkle_scale; tex.noise_depth = 2
        d = ob.modifiers.new("Wrinkles", 'DISPLACE'); d.texture = tex; d.strength = wrinkle
        d.texture_coords = 'LOCAL'; d.mid_level = 0.5
    a = ob.modifiers.new("Armature", 'ARMATURE'); a.object = rig
    cs = ob.modifiers.new("CorrectiveSmooth", 'CORRECTIVE_SMOOTH'); cs.factor = 0.5; cs.iterations = 5
    cs.use_only_smooth = False
    s = ob.modifiers.new("Thickness", 'SOLIDIFY'); s.thickness = solid; s.offset = 1.0; s.use_even_offset = False
    sd = ob.modifiers.new("Subdiv", 'SUBSURF'); sd.levels = 0; sd.render_levels = subdiv

def boundary_loops(ob):
    bmh = bmesh.new(); bmh.from_mesh(ob.data)
    edges = [e for e in bmh.edges if e.is_boundary]
    loops = []; used = set()
    for e in edges:
        if e.index in used: continue
        loop = [e.verts[0].index]; cur = e.verts[1]; prev = e; used.add(e.index)
        while True:
            loop.append(cur.index)
            nxt = [x for x in cur.link_edges if x.is_boundary and x.index not in used]
            if not nxt: break
            prev = nxt[0]; used.add(prev.index); cur = prev.other_vert(cur)
            if cur.index == loop[0]: break
        loops.append(loop)
    bmh.free()
    return loops

def extrude_rings(ob, loop, ring_fns, closed=True, skip=None, mat_index=0):
    """ring_fns: list of functions co -> new co, each producing the next ring from the previous.
    skip(co) -> True leaves a gap at that loop vertex (e.g. collar opening)."""
    me = ob.data
    bmh = bmesh.new(); bmh.from_mesh(me); bmh.verts.ensure_lookup_table()
    prev = [bmh.verts[i] for i in loop]
    ok = [not (skip and skip(v.co)) for v in prev]
    dvert = bmh.verts.layers.deform.active
    for fn in ring_fns:
        cur = []
        for v in prev:
            nv = bmh.verts.new(fn(v.co.copy()))
            if dvert: nv[dvert] = v[dvert]
            cur.append(nv)
        n = len(prev)
        for i in range(n if closed else n - 1):
            j = (i + 1) % n
            if not (ok[i] and ok[j]): continue
            try:
                f = bmh.faces.new((prev[i], prev[j], cur[j], cur[i]))
                f.smooth = True; f.material_index = mat_index
            except ValueError:
                pass
        prev = cur
    loose = [v for v in bmh.verts if not v.link_faces]
    bmesh.ops.delete(bmh, geom=loose, context='VERTS')
    bmh.normal_update()
    bmh.to_mesh(me); bmh.free()

def fabric_material(name, base_hex, pattern="plain", rough=0.82, sheen=0.35, weave_scale=1800.0, dims=(1, 1, 1),
                    line_hex=None, dirt=0.25, dust=0.0, sweat=0.0):
    m = bpy.data.materials.new(name)
    nb = NB(m)
    P = nb.metric(dims)
    base = srgb(base_hex)
    c = nb.mixc('MULTIPLY', 1.0, base, (1, 1, 1, 1))
    sep = nb.n("ShaderNodeSeparateXYZ"); nb.l(P, sep.inputs[0])
    if pattern == "check":
        lc = srgb(line_hex or "#FFFFFF")
        a = nb.math('PINGPONG', nb.math('ADD', sep.outputs[0], sep.outputs[1]), 0.011)
        b = nb.math('PINGPONG', sep.outputs[2], 0.011)
        la = nb.maprange(a, 0.0075, 0.0105)
        lb = nb.maprange(b, 0.0075, 0.0105)
        c = nb.mixc('MIX', nb.math('MULTIPLY', nb.math('ADD', la, lb), 0.22), c, lc)
    if pattern == "twill":
        tw = nb.n("ShaderNodeTexWave", wave_type='BANDS', bands_direction='DIAGONAL')
        nb.l(P, tw.inputs["Vector"]); tw.inputs["Scale"].default_value = 900.0
        c = nb.mixc('MULTIPLY', nb.maprange(tw.outputs["Fac"], 0, 1, 0.0, 0.12), c, (0.7, 0.7, 0.7, 1))
    # fading / dirt / sweat
    big = nb.noise(P, 4.0, 5.0, 0.6)
    c = nb.mixc('MULTIPLY', nb.maprange(big, 0.4, 0.7, 0.0, dirt), c, (0.72, 0.68, 0.62, 1))
    if sweat > 0:
        sw = nb.maprange(nb.noise(P, 3.0, 3.0, 0.5), 0.55, 0.68, 0.0, sweat)
        c = nb.mixc('MULTIPLY', sw, c, (0.62, 0.62, 0.62, 1))
    if dust > 0:
        dn = nb.maprange(nb.noise(P, 3.0, 4.0, 0.55), 0.42, 0.8, 0.0, dust)
        c = nb.mixc('MIX', dn, c, (0.36, 0.34, 0.31, 1))
    weave = nb.n("ShaderNodeTexWave", wave_type='BANDS', bands_direction='X')
    nb.l(P, weave.inputs["Vector"]); weave.inputs["Scale"].default_value = weave_scale
    weave2 = nb.n("ShaderNodeTexWave", wave_type='BANDS', bands_direction='Z')
    nb.l(P, weave2.inputs["Vector"]); weave2.inputs["Scale"].default_value = weave_scale
    h = nb.math('ADD', weave.outputs["Fac"], weave2.outputs["Fac"])
    h = nb.math('ADD', h, nb.math('MULTIPLY', nb.noise(P, 60.0, 6.0, 0.6), 2.0))
    bump = nb.n("ShaderNodeBump"); nb.l(h, bump.inputs["Height"])
    bump.inputs["Strength"].default_value = 0.3; bump.inputs["Distance"].default_value = 0.0004
    p = principled(nb, Base_Color=c, Roughness=rough, Sheen_Weight=sheen, Sheen_Roughness=0.6,
                   Specular_IOR_Level=0.35)
    nb.l(bump.outputs[0], p.inputs["Normal"])
    nb.out(p.outputs[0])
    return m

def leather_material(name, hex_, rough=0.45, dust=0.3, dims=(1, 1, 1), sole_z=None):
    m = bpy.data.materials.new(name); nb = NB(m)
    P = nb.metric(dims)
    n = nb.noise(P, 40.0, 8.0, 0.6)
    c = nb.mixc('MULTIPLY', nb.maprange(n, 0.3, 0.7, 0.0, 0.3), srgb(hex_), (0.6, 0.55, 0.5, 1))
    dn = nb.maprange(nb.noise(P, 4.0, 4.0, 0.55), 0.42, 0.8, 0.0, dust)
    c = nb.mixc('MIX', dn, c, (0.33, 0.31, 0.28, 1))
    r = nb.mixf(dn, rough, 0.85)
    hgt = nb.noise(P, 500.0, 6.0, 0.6)
    if sole_z is not None:
        sep = nb.n("ShaderNodeSeparateXYZ"); nb.l(P, sep.inputs[0])
        sole = nb.maprange(sep.outputs[2], sole_z + 0.002, sole_z)
        welt = nb.maprange(nb.math('ABSOLUTE', nb.math('SUBTRACT', sep.outputs[2], sole_z + 0.004)), 0.0016, 0.0006)
        c = nb.mixc('MIX', sole, c, (0.025, 0.024, 0.023, 1))
        c = nb.mixc('MULTIPLY', nb.math('MULTIPLY', welt, 0.6), c, (0.4, 0.38, 0.36, 1))
        r = nb.mixf(sole, r, 0.8)
        hgt = nb.math('SUBTRACT', hgt, nb.math('MULTIPLY', welt, 4.0))
    bump = nb.n("ShaderNodeBump"); nb.l(hgt, bump.inputs["Height"])
    bump.inputs["Strength"].default_value = 0.25; bump.inputs["Distance"].default_value = 0.0005
    p = principled(nb, Base_Color=c, Roughness=r)
    nb.l(bump.outputs[0], p.inputs["Normal"]); nb.out(p.outputs[0])
    return m

def plastic_material(name, hex_, rough=0.28, scuff=0.3, dirt=0.2, dims=(1, 1, 1)):
    m = bpy.data.materials.new(name); nb = NB(m)
    P = nb.metric(dims)
    sc = nb.maprange(nb.noise(P, 220.0, 6.0, 0.7, dist=1.5), 0.62, 0.7, 0.0, scuff)
    dn = nb.maprange(nb.noise(P, 14.0, 6.0, 0.6), 0.5, 0.75, 0.0, dirt)
    c = nb.mixc('MIX', dn, srgb(hex_), (0.30, 0.27, 0.22, 1))
    c = nb.mixc('MULTIPLY', sc, c, (0.8, 0.8, 0.8, 1))
    r = nb.mixf(nb.math('MAXIMUM', sc, dn), rough, 0.7)
    bump = nb.n("ShaderNodeBump"); nb.l(nb.math('ADD', sc, nb.noise(P, 900.0, 3.0, 0.5)), bump.inputs["Height"])
    bump.inputs["Strength"].default_value = 0.08; bump.inputs["Distance"].default_value = 0.0003
    p = principled(nb, Base_Color=c, Roughness=r, Specular_IOR_Level=0.5)
    nb.l(bump.outputs[0], p.inputs["Normal"]); nb.out(p.outputs[0])
    return m

# ================================================================ HELMET
def make_helmet(info, rig, coll, mat, harness_mat, tilt=6.0):
    hc = info["head_c"]; hs = info["scalp_size"]
    rx = hs.x / 2 + 0.016; ry = hs.y / 2 + 0.018; rz = hs.z * 0.62 + 0.012
    bmh = bmesh.new()
    bmesh.ops.create_uvsphere(bmh, u_segments=64, v_segments=32, radius=1.0)
    for v in list(bmh.verts):
        if v.co.z < -0.02:
            bmh.verts.remove(v)
    bmh.verts.ensure_lookup_table()
    for v in bmh.verts:
        v.co = Vector((v.co.x * rx, v.co.y * ry, max(v.co.z, 0) * rz))
    # rim: extrude open edge outward into a brim, longer at the front (peak)
    edges = [e for e in bmh.edges if e.is_boundary]
    ret = bmesh.ops.extrude_edge_only(bmh, edges=edges)
    nv = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMVert)]
    for v in nv:
        h = Vector((v.co.x, v.co.y, 0)).normalized()
        front = max(0.0, -h.y) ** 2.5
        v.co += h * (0.007 + 0.038 * front) + Vector((0, 0, -0.003 - 0.010 * front))
    ret = bmesh.ops.extrude_edge_only(bmh, edges=[e for e in bmh.edges if e.is_boundary])
    nv = [g for g in ret["geom"] if isinstance(g, bmesh.types.BMVert)]
    for v in nv:
        v.co += Vector((0, 0, -0.004))
    # central ridge
    for v in bmh.verts:
        if v.co.z > rz * 0.35:
            w = math.exp(-(v.co.x / 0.012) ** 2)
            v.co.z += 0.007 * w * min(1, (v.co.z / rz))
    me = bpy.data.meshes.new("HELMET"); bmh.to_mesh(me); bmh.free()
    for pg in me.polygons: pg.use_smooth = True
    me.materials.append(mat)
    ob = bpy.data.objects.new("HELMET", me); coll.objects.link(ob)
    ob.location = Vector((0, hc.y + 0.004, info["eye_l"].z + 0.036))
    ob.rotation_euler = (math.radians(-tilt), 0, 0)
    s = ob.modifiers.new("Shell", 'SOLIDIFY'); s.thickness = 0.0035; s.offset = 1.0
    b = ob.modifiers.new("Bevel", 'BEVEL'); b.width = 0.0012; b.segments = 2; b.limit_method = 'ANGLE'
    sd = ob.modifiers.new("Subdiv", 'SUBSURF'); sd.levels = 1; sd.render_levels = 2
    # inner harness band
    bmh = bmesh.new()
    bmesh.ops.create_circle(bmh, cap_ends=False, segments=48, radius=1.0)
    for v in bmh.verts: v.co = Vector((v.co.x * (rx - 0.012), v.co.y * (ry - 0.012), 0.012))
    ret = bmesh.ops.extrude_edge_only(bmh, edges=bmh.edges[:])
    for g in ret["geom"]:
        if isinstance(g, bmesh.types.BMVert): g.co.z -= 0.022
    me2 = bpy.data.meshes.new("HELMET_harness"); bmh.to_mesh(me2); bmh.free()
    me2.materials.append(harness_mat)
    hb = bpy.data.objects.new("HELMET_harness", me2); coll.objects.link(hb)
    hb.parent = ob
    hs2 = hb.modifiers.new("T", 'SOLIDIFY'); hs2.thickness = 0.002
    upd()
    mw = ob.matrix_world.copy()
    ob.parent = rig; ob.parent_type = 'BONE'; ob.parent_bone = "head"
    upd(); ob.matrix_world = mw
    return ob

# ================================================================ POSING (analytic, world space)
def bw(rig, n): return rig.matrix_world @ rig.pose.bones[n].matrix
def set_bw(rig, n, M):
    rig.pose.bones[n].matrix = rig.matrix_world.inverted() @ M; upd()
def rot_bone(rig, n, R3, pivot=None):
    M = bw(rig, n); h = M.to_translation() if pivot is None else pivot
    set_bw(rig, n, Matrix.Translation(h) @ R3.to_4x4() @ Matrix.Translation(-h) @ M)
def head_of(rig, n): return bw(rig, n).to_translation()
def tail_of(rig, n):
    M = bw(rig, n); return M @ Vector((0, rig.data.bones[n].length, 0))
def ydir(rig, n): return (tail_of(rig, n) - head_of(rig, n)).normalized()
def aim(rig, n, target):
    q = ydir(rig, n).rotation_difference((target - head_of(rig, n)).normalized())
    rot_bone(rig, n, q.to_matrix())

def two_bone(rig, up, lo, target, pole):
    S = head_of(rig, up); a = rig.data.bones[up].length; b = rig.data.bones[lo].length
    d = target - S; dist = min(d.length, (a + b) * 0.995); dn = d.normalized()
    cosA = (a * a + dist * dist - b * b) / (2 * a * dist); sinA = math.sqrt(max(0, 1 - cosA * cosA))
    pp = (pole - S); pp = (pp - dn * pp.dot(dn)).normalized()
    E = S + dn * a * cosA + pp * a * sinA
    aim(rig, up, E); aim(rig, lo, S + dn * dist)

def hand_frame(rig, side):
    s = side
    h = head_of(rig, "hand" + s)
    d = (head_of(rig, "middle_01" + s) - h).normalized()
    a = (head_of(rig, "index_01" + s) - head_of(rig, "pinky_01" + s)).normalized()
    n = d.cross(a) if s == "_l" else a.cross(d)
    n = (n - d * n.dot(d)).normalized()
    return h, d, n

def basis(d, n):
    d = d.normalized(); n = (n - d * n.dot(d)).normalized()
    return Matrix((d, n, d.cross(n))).transposed()

def orient_hand(rig, side, d_new, n_new):
    h, d, n = hand_frame(rig, side)
    R = basis(d_new, n_new) @ basis(d, n).transposed()
    rot_bone(rig, "hand" + side, R)

def distribute_twist(rig, side, frac=0.6):
    """Move part of the hand's twist into the forearm (pronation) to avoid candy-wrap wrists."""
    lo, ha = "lowerarm" + side, "hand" + side
    Mh = bw(rig, ha).copy()
    Rl = bw(rig, lo).to_quaternion(); Rh = Mh.to_quaternion()
    rel = Rl.inverted() @ Rh
    twist = 2 * math.atan2(rel.y, rel.w)
    if twist > math.pi: twist -= 2 * math.pi
    if twist < -math.pi: twist += 2 * math.pi
    ax = ydir(rig, lo)
    rot_bone(rig, lo, Matrix.Rotation(twist * frac, 3, ax))
    set_bw(rig, ha, Mh)
    return math.degrees(twist)

def place_hand(rig, side, palm_center, d_new, n_new, pole, palm_off=0.013, iters=3, along=0.048):
    for _ in range(iters):
        h, d, n = hand_frame(rig, side)
        R = basis(d_new, n_new) @ basis(d, n).transposed()
        off = R @ (d * along + n * palm_off)
        wrist = palm_center - off
        two_bone(rig, "upperarm" + side, "lowerarm" + side, wrist, pole)
        orient_hand(rig, side, d_new, n_new)
        tw = distribute_twist(rig, side)
        orient_hand(rig, side, d_new, n_new)
    h, d, n = hand_frame(rig, side)
    print("HAND", side, "d", tuple(round(c, 2) for c in d), "want", tuple(round(c, 2) for c in d_new.normalized()),
          "n", tuple(round(c, 2) for c in n), "want", tuple(round(c, 2) for c in n_new.normalized()), "twist", round(tw, 1),
          "wrist", tuple(round(c, 3) for c in h))

def obj_bvh(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    oe = ob.evaluated_get(dg)
    me = oe.to_mesh()
    bmh = bmesh.new(); bmh.from_mesh(me); bmh.transform(ob.matrix_world)
    bmesh.ops.recalc_face_normals(bmh, faces=bmh.faces[:])
    t = BVHTree.FromBMesh(bmh); bmh.free(); oe.to_mesh_clear()
    return t

def _contact(rig, bones, bvhs, radii):
    for bn, r in zip(bones, radii):
        h = head_of(rig, bn); t = tail_of(rig, bn)
        for k in range(1, 6):
            p = h.lerp(t, k / 5)
            for bvh in bvhs:
                hit, nrm, _, dist = bvh.find_nearest(p)
                if hit is None: continue
                if (p - hit).dot(nrm) < r:
                    return True
    return False

def curl_finger(rig, side, finger, bvhs, maxdeg=(80, 95, 70), mindeg=(8, 10, 6), radii=(0.0095, 0.0085, 0.0072), step=2.0, wrap=False):
    """Curl each segment toward the palm until the finger chain touches the prop surface.
    Segments that start inside the prop are first opened until they are clear."""
    names = [f"{finger}_0{i}{side}" for i in (1, 2, 3)]
    _, _, n = hand_frame(rig, side)
    for i, bn in enumerate(names):
        chain = names[i:i + 1] if wrap else names[i:]; rr = radii[i:i + 1] if wrap else radii[i:]
        total = 0.0; touched = False
        def rot(deg):
            d = ydir(rig, bn); ax = d.cross(n).normalized()
            rot_bone(rig, bn, Matrix.Rotation(math.radians(deg), 3, ax))
        while _contact(rig, chain, bvhs, rr) and total > -45:
            rot(-step); total -= step
        if total < 0:
            touched = not wrap
        while not touched and total < maxdeg[i]:
            rot(step); total += step
            if _contact(rig, chain, bvhs, rr):
                rot(-step); total -= step; touched = True
        if not touched and total < mindeg[i]:
            rot(mindeg[i] - total); total = mindeg[i]
        tl = tail_of(rig, bn); hd = head_of(rig, bn)
        dd = [bv.find_nearest(tl) for bv in bvhs]
        print("   seg", bn, "deg", round(total, 1), "touch", touched, "tail-dist", [round(x[3], 4) if x[0] else None for x in dd],
              "head", tuple(round(c, 3) for c in hd))

def pose_to_action(rig, name):
    act = bpy.data.actions.new(name)
    rig.animation_data_create(); rig.animation_data.action = act
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    # convert pose matrices into channels
    for pb in rig.pose.bones:
        pb.keyframe_insert("location", frame=1, group=pb.name)
        pb.keyframe_insert("rotation_quaternion", frame=1, group=pb.name)
    return act

def reset_pose(rig):
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.location = (0, 0, 0); pb.rotation_quaternion = (1, 0, 0, 0); pb.scale = (1, 1, 1)
    upd()

# ================================================================ QC
def qc_rig(coll, cam_loc, look_at, lens=85.0, fstop=4.0, key=(1.2, -1.4, 1.9), key_power=180.0):
    sc = bpy.context.scene
    try: sc.render.engine = 'BLENDER_EEVEE'
    except TypeError: sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'AgX'
    try: sc.view_settings.look = 'AgX - Base Contrast'
    except Exception: pass
    ee = sc.eevee
    for k, v in (("taa_render_samples", 64), ("use_raytracing", True), ("use_shadows", True),
                 ("shadow_ray_count", 2), ("shadow_step_count", 8), ("use_fast_gi", True)):
        if hasattr(ee, k): setattr(ee, k, v)
    if hasattr(ee, "ray_tracing_options"):
        ee.ray_tracing_options.resolution_scale = '1'
    sc.render.hair_type = 'STRAND'; sc.render.hair_subdiv = 2
    w = bpy.data.worlds.get("QC_grey") or bpy.data.worlds.new("QC_grey")
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (0.18, 0.18, 0.18, 1); bg.inputs[1].default_value = 0.6
    sc.world = w
    cd = bpy.data.cameras.new("QC_cam"); cd.lens = lens; cd.sensor_width = 36
    cd.dof.use_dof = True; cd.dof.aperture_fstop = fstop
    cam = bpy.data.objects.new("QC_cam", cd); coll.objects.link(cam)
    cam.location = cam_loc
    cam.rotation_euler = (look_at - cam_loc).to_track_quat('-Z', 'Y').to_euler()
    cd.dof.focus_distance = (look_at - cam_loc).length
    sc.camera = cam
    def area(name, loc, power, size, col):
        ld = bpy.data.lights.new(name, 'AREA'); ld.energy = power; ld.size = size; ld.color = col
        o = bpy.data.objects.new(name, ld); coll.objects.link(o)
        o.location = loc; o.rotation_euler = (look_at - loc).to_track_quat('-Z', 'Y').to_euler()
        return o
    area("QC_key", look_at + Vector(key), key_power, 0.9, (1.0, 0.93, 0.85))
    area("QC_fill", look_at + Vector((-1.6, -1.2, 0.4)), key_power * 0.25, 1.6, (0.9, 0.95, 1.0))
    area("QC_rim", look_at + Vector((-0.6, 1.6, 1.2)), key_power * 0.9, 0.6, (1.0, 0.97, 0.92))
    return cam


def aim_chain(rig, bones, points):
    for bn, p in zip(bones, points):
        aim(rig, bn, p)
