"""HEMISPHERE ONE - shared human-building helpers (Blender 5.2, MPFB 2.0.18).
Everything here is procedural / built from MPFB's bundled CC0 base mesh. No external assets."""
import bpy, bmesh, math, random, os
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree

MPFB_DATA = os.path.join(os.environ["APPDATA"], "Blender Foundation", "Blender", "5.2",
                         "extensions", "blender_org", "mpfb", "data")

def upd():
    bpy.context.view_layer.update()

def srgb(h):
    h = h.lstrip('#')
    def c(v):
        v = int(v, 16) / 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (c(h[0:2]), c(h[2:4]), c(h[4:6]), 1.0)

# ---------------------------------------------------------------- scene
def clean_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.curves,
                 bpy.data.hair_curves, bpy.data.textures, bpy.data.node_groups, bpy.data.cameras, bpy.data.lights):
        for d in list(coll):
            coll.remove(d)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)

def get_coll(name, parent=None):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    p = parent or bpy.context.scene.collection
    if c.name not in [x.name for x in p.children]:
        p.children.link(c)
    return c

def move_to(obj, coll):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)

# ---------------------------------------------------------------- MPFB human
def make_human(macro, details):
    from bl_ext.blender_org.mpfb.services.humanservice import HumanService
    from bl_ext.blender_org.mpfb.services.targetservice import TargetService
    m = TargetService.get_default_macro_info_dict()
    race = macro.pop("race")
    m.update(macro); m["race"] = race
    bm = HumanService.create_human(macro_detail_dict=m)
    for rel, w in details.items():
        p = os.path.join(MPFB_DATA, "targets", rel + ".target.gz")
        TargetService.load_target(bm, p, weight=w)
    TargetService.bake_targets(bm)
    rig = HumanService.add_builtin_rig(bm, "game_engine")
    return bm, rig

def add_expression_keys(bm, keys):
    """keys: {name: {unit: weight}} -> one shape key per name, built from MakeHuman face units (CC0)."""
    from bl_ext.blender_org.mpfb.services.targetservice import TargetService
    if not bm.data.shape_keys:
        bm.shape_key_add(name="Basis")
    units = sorted({u for d in keys.values() for u in d})
    for u in units:
        p = os.path.join(MPFB_DATA, "targets", "expression", "units", "caucasian", u + ".target.gz")
        sk = TargetService.load_target(bm, p, weight=0.0, name="unit_" + u)
    kb = bm.data.shape_keys.key_blocks
    for name, d in keys.items():
        for k in kb: k.value = 0.0
        for u, w in d.items(): kb["unit_" + u].value = w
        bm.shape_key_add(name=name, from_mix=True)
    for k in list(kb):
        if k.name.startswith("unit_"):
            bm.shape_key_remove(k)
    for k in bm.data.shape_keys.key_blocks: k.value = 0.0

def vg_set(obj, name):
    g = obj.vertex_groups.get(name)
    if not g: return set()
    gi = g.index
    return {v.index for v in obj.data.vertices if any(x.group == gi and x.weight > 0.5 for x in v.groups)}

def centroid(obj, idx):
    vs = [obj.data.vertices[i].co for i in idx]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return (mn + mx) / 2, mx - mn

def dominant_bones(obj, rig):
    names = {b.name for b in rig.data.bones}
    gi = {g.index: g.name for g in obj.vertex_groups if g.name in names}
    out = []
    for v in obj.data.vertices:
        best, bw = None, 0.0
        for g in v.groups:
            if g.group in gi and g.weight > bw:
                best, bw = gi[g.group], g.weight
        out.append(best)
    return out

def adjacency(me):
    adj = [set() for _ in me.vertices]
    for e in me.edges:
        a, b = e.vertices
        adj[a].add(b); adj[b].add(a)
    return adj

def grow(sel, adj, n):
    s = set(sel)
    for _ in range(n):
        s |= {j for i in s for j in adj[i]}
    return s

def shrink(sel, adj, n):
    s = set(sel)
    for _ in range(n):
        s = {i for i in s if adj[i] <= s}
    return s

# ---------------------------------------------------------------- nodes
class NB:
    def __init__(self, mat):
        mat.use_nodes = True
        self.nt = mat.node_tree
        self.nt.nodes.clear()
        self.x = 0
    def n(self, t, **kw):
        nd = self.nt.nodes.new(t)
        nd.location = (self.x, 0); self.x += 40
        for k, v in kw.items():
            if hasattr(nd, k) and not k.startswith("in_"):
                setattr(nd, k, v)
        for k, v in kw.items():
            if k.startswith("in_"):
                nd.inputs[k[3:].replace("_", " ")].default_value = v
        return nd
    def l(self, a, b):
        self.nt.links.new(a, b)
    def math(self, op, a, b=None, clamp=False):
        m = self.n("ShaderNodeMath", operation=op, use_clamp=clamp)
        self._feed(m.inputs[0], a)
        if b is not None: self._feed(m.inputs[1], b)
        return m.outputs[0]
    def _feed(self, sock, v):
        if isinstance(v, (int, float)): sock.default_value = v
        else: self.l(v, sock)
    def mixc(self, blend, fac, a, b):
        m = self.n("ShaderNodeMix", data_type='RGBA', blend_type=blend, clamp_result=False)
        self._feed(m.inputs[0], fac)
        for sock, v in ((m.inputs[6], a), (m.inputs[7], b)):
            if isinstance(v, tuple): sock.default_value = v
            else: self.l(v, sock)
        return m.outputs[2]
    def mixf(self, fac, a, b):
        m = self.n("ShaderNodeMix", data_type='FLOAT')
        self._feed(m.inputs[0], fac); self._feed(m.inputs[2], a); self._feed(m.inputs[3], b)
        return m.outputs[0]
    def maprange(self, v, a, b, c=0.0, d=1.0, smooth=True):
        m = self.n("ShaderNodeMapRange", interpolation_type='SMOOTHSTEP' if (smooth and a < b) else 'LINEAR', clamp=True)
        self._feed(m.inputs[0], v)
        m.inputs[1].default_value = a; m.inputs[2].default_value = b
        m.inputs[3].default_value = c; m.inputs[4].default_value = d
        return m.outputs[0]
    def attr(self, name):
        a = self.n("ShaderNodeAttribute", attribute_name=name)
        s = self.n("ShaderNodeSeparateColor")
        self.l(a.outputs["Color"], s.inputs[0])
        return s.outputs[0], s.outputs[1], s.outputs[2], a.outputs["Alpha"]
    def metric(self, dims=None):
        # object-space metres (objects sit at the origin, unit scale, baked in rest pose)
        tc = self.n("ShaderNodeTexCoord")
        return tc.outputs["Object"]
    def noise(self, vec, scale, detail=4.0, rough=0.5, dist=0.0, dim='3D'):
        t = self.n("ShaderNodeTexNoise", noise_dimensions=dim)
        if vec is not None: self.l(vec, t.inputs["Vector"])
        t.inputs["Scale"].default_value = scale; t.inputs["Detail"].default_value = detail
        t.inputs["Roughness"].default_value = rough; t.inputs["Distortion"].default_value = dist
        return t.outputs["Fac"]
    def voronoi(self, vec, scale, rand=1.0):
        t = self.n("ShaderNodeTexVoronoi", feature='F1', distance='EUCLIDEAN')
        if vec is not None: self.l(vec, t.inputs["Vector"])
        t.inputs["Scale"].default_value = scale; t.inputs["Randomness"].default_value = rand
        return t.outputs["Distance"]
    def out(self, shader):
        o = self.n("ShaderNodeOutputMaterial")
        self.l(shader, o.inputs["Surface"])

def principled(nb, **kw):
    p = nb.n("ShaderNodeBsdfPrincipled")
    for k, v in kw.items():
        sock = p.inputs.get(k.replace("_", " "))
        if sock is None:
            print("WARN principled input missing:", k); continue
        if isinstance(v, (int, float, tuple, list)): sock.default_value = v
        else: nb.l(v, sock)
    return p

# ---------------------------------------------------------------- skin
def skin_material(name, tone_hex, dims, sss_scale=0.004, red_amt=0.25, stubble=0.6,
                  stubble_col=(0.012, 0.010, 0.010, 1), hair_col=(0.010, 0.007, 0.006, 1), grey=0.0, dust=0.0):
    mat = bpy.data.materials.new(name)
    nb = NB(mat)
    P = nb.metric(dims)
    R1, G1, B1, A1 = nb.attr("HO_mask")    # stubble, redness, t-zone, knuckles/joints
    R2, G2, B2, A2 = nb.attr("HO_mask2")   # lips, scalp hair, nails, periorbital
    base = srgb(tone_hex)
    n1 = nb.noise(P, 18.0, 5.0, 0.55)
    n2 = nb.noise(P, 90.0, 3.0, 0.5)
    n3 = nb.noise(P, 260.0, 4.0, 0.6)
    var = nb.maprange(nb.math('ADD', nb.math('ADD', n1, nb.math('MULTIPLY', n2, 0.35)), nb.math('MULTIPLY', n3, 0.25)), 0.5, 1.2, 0.84, 1.08, smooth=False)
    c = nb.mixc('MULTIPLY', 1.0, base, (1, 1, 1, 1))
    cv = nb.n("ShaderNodeCombineColor")
    for i in range(3): nb.l(var, cv.inputs[i])
    c = nb.mixc('MULTIPLY', 1.0, c, cv.outputs[0])
    c = nb.mixc('MULTIPLY', nb.math('MULTIPLY', G1, red_amt), c, (1.35, 0.78, 0.72, 1))
    c = nb.mixc('MULTIPLY', nb.math('MULTIPLY', A2, 0.9), c, (0.78, 0.74, 0.76, 1))
    c = nb.mixc('MULTIPLY', nb.math('MULTIPLY', A1, 0.9), c, (0.74, 0.70, 0.70, 1))
    c = nb.mixc('MULTIPLY', nb.math('MULTIPLY', R2, 0.85), c, (0.86, 0.66, 0.68, 1))
    c = nb.mixc('MIX', nb.math('MULTIPLY', B2, 0.75), c, (0.40, 0.28, 0.24, 1))
    # stubble: dense dots inside beard mask
    dots = nb.maprange(nb.voronoi(P, 2200.0), 0.30, 0.12)
    shadow = nb.math('MULTIPLY', R1, 0.55)
    c = nb.mixc('MULTIPLY', shadow, c, (0.72, 0.72, 0.76, 1))
    sfac = nb.math('MULTIPLY', nb.math('MULTIPLY', R1, dots), stubble)
    scol = stubble_col if grey <= 0 else tuple(stubble_col[i] * (1 - grey) + 0.30 * grey for i in range(3)) + (1,)
    c = nb.mixc('MIX', sfac, c, scol)
    # cropped scalp hair
    hn = nb.noise(P, 1400.0, 2.0, 0.6)
    hfac = nb.math('MULTIPLY', G2, nb.maprange(hn, 0.35, 0.6, 0.75, 1.0))
    c = nb.mixc('MIX', hfac, c, hair_col)
    if dust > 0:
        dn = nb.noise(P, 6.0, 6.0, 0.6)
        dm = nb.math('MULTIPLY', nb.maprange(dn, 0.48, 0.7), dust)
        c = nb.mixc('MIX', dm, c, (0.30, 0.28, 0.25, 1))
    # roughness
    r = nb.maprange(n2, 0.3, 0.7, 0.50, 0.62, smooth=False)
    r = nb.mixf(B1, r, 0.42)
    r = nb.mixf(R2, r, 0.52)
    r = nb.mixf(B2, r, 0.24)
    r = nb.mixf(G2, r, 0.6)
    if dust > 0:
        r = nb.mixf(dm, r, 0.8)
    # micro normal: pores + fine creases
    pores = nb.maprange(nb.voronoi(P, 950.0, 0.9), 0.0, 0.45, 0.0, 1.0)
    mid = nb.noise(P, 45.0, 6.0, 0.6)
    fine = nb.noise(P, 380.0, 8.0, 0.65)
    h = nb.math('ADD', nb.math('MULTIPLY', pores, 0.8), nb.math('MULTIPLY', fine, 0.6))
    h = nb.math('ADD', h, nb.math('MULTIPLY', mid, 1.6))
    h = nb.math('ADD', h, nb.math('MULTIPLY', sfac, 0.4))
    bump = nb.n("ShaderNodeBump", invert=False)
    nb.l(h, bump.inputs["Height"])
    bump.inputs["Strength"].default_value = 0.5
    bump.inputs["Distance"].default_value = 0.0004
    p = principled(nb, Base_Color=c, Roughness=r, Subsurface_Weight=1.0,
                   Subsurface_Radius=(1.0, 0.40, 0.25), Subsurface_Scale=sss_scale,
                   Specular_IOR_Level=0.42, Coat_Weight=0.0)
    p.inputs["Coat Weight"].default_value = 0.0
    nb.l(bump.outputs[0], p.inputs["Normal"])
    nb.out(p.outputs[0])
    return mat

def write_masks(bm, rig, info, beard=True):
    """Bake region masks into colour attributes (deform with the mesh)."""
    me = bm.data
    co = [v.co.copy() for v in me.vertices]
    nrm = [v.normal.copy() for v in me.vertices]
    El, Er = info["eye_l"], info["eye_r"]
    M = info["mouth"]; lip_top = info["lip_top"]
    nose = info["nose_tip"]
    lips = vg_set(bm, "lips"); scalp = vg_set(bm, "scalp"); ears = vg_set(bm, "ears")
    nails = vg_set(bm, "fingernails") | vg_set(bm, "toenails")
    knuck = []
    for b in rig.data.bones:
        if any(b.name.startswith(f) for f in ("index_0", "middle_0", "ring_0", "pinky_0", "thumb_0")):
            knuck.append(b.head_local.copy())
    elbows = [rig.data.bones["lowerarm_l"].head_local.copy(), rig.data.bones["lowerarm_r"].head_local.copy()]
    knees = [rig.data.bones["calf_l"].head_local.copy(), rig.data.bones["calf_r"].head_local.copy()]
    head_c = info["head_c"]
    def ss(e0, e1, x):
        t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
        return t * t * (3 - 2 * t)
    m1 = [0.0] * (len(co) * 4); m2 = [0.0] * (len(co) * 4)
    eye_z = El.z
    for i, p in enumerate(co):
        ax = abs(p.x)
        # beard/stubble
        st = 0.0
        if beard and p.z < eye_z and i not in lips:
            z_top = lip_top + 0.014 + (min(ax, 0.075) / 0.075) ** 1.6 * (eye_z - 0.012 - lip_top - 0.014)
            front = p.y < head_c.y + 0.03
            if front and ax < 0.078:
                st = ss(z_top + 0.004, z_top - 0.006, p.z) * ss(M.z - 0.125, M.z - 0.085, p.z)
                st *= ss(0.080, 0.068, ax)
        # redness: nose tip, cheeks, ears
        rd = max(ss(0.03, 0.008, (p - nose).length),
                 ss(0.035, 0.012, (p - Vector((0.042 if p.x > 0 else -0.042, El.y - 0.005, eye_z - 0.035))).length),
                 1.0 if i in ears else 0.0)
        # t-zone
        tz = 0.0
        if p.y < head_c.y - 0.02 and ax < 0.05:
            tz = max(ss(eye_z + 0.008, eye_z + 0.02, p.z) * ss(eye_z + 0.075, eye_z + 0.055, p.z),
                     ss(0.022, 0.008, Vector((p.x, 0, 0)).length) * ss(lip_top + 0.01, lip_top + 0.02, p.z) * ss(eye_z + 0.01, eye_z - 0.005, p.z))
        # knuckles/elbows/knees (dorsal side darker)
        kn = 0.0
        for k in knuck:
            d = (p - k).length
            if d < 0.012: kn = max(kn, ss(0.012, 0.004, d))
        for k in elbows:
            d = (p - k).length
            if d < 0.05 and (p - k).y > -0.0: kn = max(kn, ss(0.05, 0.02, d))
        for k in knees:
            d = (p - k).length
            if d < 0.06 and (p - k).y < 0.0: kn = max(kn, 0.7 * ss(0.06, 0.03, d))
        # periorbital
        po = 0.0
        for E in (El, Er):
            d = (p - E).length
            if p.y < E.y + 0.005:
                po = max(po, ss(0.012, 0.018, d) * ss(0.036, 0.022, d) * (1.0 if p.z < E.z + 0.01 else 0.55))
        hair = 1.0 if i in scalp else 0.0
        m1[i*4:i*4+4] = (st, rd, tz, kn)
        m2[i*4:i*4+4] = (1.0 if i in lips else 0.0, hair, 1.0 if i in nails else 0.0, po)
    for nm, data in (("HO_mask", m1), ("HO_mask2", m2)):
        if nm in me.color_attributes: me.color_attributes.remove(me.color_attributes[nm])
        a = me.color_attributes.new(nm, 'FLOAT_COLOR', 'POINT')
        a.data.foreach_set("color", data)
    # soften masks a little across neighbours
    adj = adjacency(me)
    for nm in ("HO_mask", "HO_mask2"):
        a = me.color_attributes[nm]
        buf = [0.0] * (len(co) * 4); a.data.foreach_get("color", buf)
        for _ in range(2):
            nb = buf[:]
            for i in range(len(co)):
                if not adj[i]: continue
                for c in range(4):
                    s = sum(buf[j*4+c] for j in adj[i]) / len(adj[i])
                    nb[i*4+c] = 0.5 * buf[i*4+c] + 0.5 * s
            buf = nb
        a.data.foreach_set("color", buf)

# ---------------------------------------------------------------- face measurements
def face_info(bm):
    me = bm.data
    el = vg_set(bm, "helper-l-eye"); er = vg_set(bm, "helper-r-eye")
    cl, sl = centroid(bm, el); cr, sr = centroid(bm, er)
    lips = vg_set(bm, "lips"); cm, sm = centroid(bm, lips)
    body = vg_set(bm, "body")
    lip_top = max(me.vertices[i].co.z for i in lips if abs(me.vertices[i].co.x) < 0.004)
    # nose tip: most forward body vertex between mouth and eyes near midline
    cand = [i for i in body if abs(me.vertices[i].co.x) < 0.006 and cm.z + 0.01 < me.vertices[i].co.z < cl.z]
    nt = min(cand, key=lambda i: me.vertices[i].co.y)
    scalp = vg_set(bm, "scalp"); hc, hs = centroid(bm, scalp)
    return dict(eye_l=cl, eye_r=cr, eye_r_size=sl, mouth=cm, mouth_size=sm, lip_top=lip_top,
                nose_tip=me.vertices[nt].co.copy(), head_c=hc, scalp_size=hs,
                scalp_min_z=min(me.vertices[i].co.z for i in scalp))
