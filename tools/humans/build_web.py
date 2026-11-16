"""Build one web-ready rigged + animated human GLB.
blender -b --python build_web.py -- <builder|worker_shutter|worker_mason|worker_plaster>"""
import bpy, bmesh, sys, os, math, json, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
from mathutils import Vector, Matrix, Quaternion
from ho_common import *
from ho_parts import *
from ho_web import *
from ho_anim import *

T0 = time.time()
ROLE = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "builder"
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "public", "models", "humans")
os.makedirs(OUT, exist_ok=True); os.makedirs(WORK, exist_ok=True)
X = Vector((1, 0, 0)); Y = Vector((0, 1, 0)); Z = Vector((0, 0, 1))
def log(*a): print("[%5.0fs]" % (time.time() - T0), *a, flush=True)

EXPR = {
    "blink": {"eye-left-closure": 1.0, "eye-right-closure": 1.0},
    "smile": {"mouth-corner-puller": 0.55, "mouth-upward-retraction": 0.12, "mouth-elevation": 0.06,
              "eye-left-slit": 0.38, "eye-right-slit": 0.34, "nose-left-elevation": 0.08, "nose-right-elevation": 0.07},
    "brow_raise": {"eyebrows-left-up": 0.75, "eyebrows-right-up": 0.7, "eyebrows-left-inner-up": 0.2, "eyebrows-right-inner-up": 0.2},
    "concentrate": {"eyebrows-left-down": 0.45, "eyebrows-right-down": 0.5, "eye-left-slit": 0.22, "eye-right-slit": 0.25,
                    "mouth-compression": 0.35},
}

CFGS = {
    "builder": dict(
        tone="#6F5444", sss=0.0028, red=0.2, stubble=0.75, grey=0.0, dust=0.0, tex=2048, budget=40000,
        macro=dict(gender=1.0, age=0.604, muscle=0.55, weight=0.6, height=0.43, proportions=0.6,
                   race={"asian": 0.10, "caucasian": 0.55, "african": 0.35}),
        details={"nose/nose-flaring-incr": 0.45, "nose/nose-nostrils-width-incr": 0.3, "nose/nose-point-width-incr": 0.35,
                 "nose/nose-scale-depth-incr": 0.15, "mouth/mouth-lowerlip-volume-incr": 0.25,
                 "mouth/mouth-upperlip-volume-incr": 0.1, "eyes/l-eye-bag-incr": 0.3, "eyes/r-eye-bag-incr": 0.25,
                 "head/head-oval": 0.35, "chin/chin-width-incr": 0.25, "eyebrows/eyebrows-trans-down": 0.25,
                 "stomach/stomach-pregnant-incr": 0.3, "neck/neck-double-incr": 0.15,
                 "cheek/l-cheek-bones-incr": 0.15, "cheek/r-cheek-volume-incr": 0.1},
        cloth=dict(tuck=0.06, sleeve="rolled", strap_x=0.0, boot_h=0.11, hem=0.03),
        shirt="#9DB4C8", trousers="#3A3A3C", boots=("#5A3A22", 0.45), helmet="#FCD301", helmet_scuff=0.25,
        hair=dict(brow_w=1.15, moustache=1.0, moustache_h=0.0155)),
    "worker_shutter": dict(
        tone="#66483A", sss=0.0025, red=0.15, stubble=0.45, grey=0.0, dust=0.25, tex=1024, budget=25000,
        macro=dict(gender=1.0, age=0.55, muscle=0.62, weight=0.35, height=0.36, proportions=0.5,
                   race={"asian": 0.15, "caucasian": 0.45, "african": 0.40}),
        details={"nose/nose-flaring-incr": 0.3, "nose/nose-scale-horiz-incr": 0.2, "mouth/mouth-lowerlip-volume-incr": 0.3,
                 "head/head-invertedtriangular": 0.35, "chin/chin-prominent-decr": 0.2 if False else 0.0,
                 "cheek/l-cheek-bones-incr": 0.3, "cheek/r-cheek-bones-incr": 0.3, "eyes/l-eye-height2-incr": 0.2,
                 "eyes/r-eye-height2-incr": 0.2, "neck/neck-scale-horiz-decr": 0.2, "ears/r-ear-scale-incr": 0.0},
        cloth=dict(tuck=0.05, sleeve="full", strap_x=0.0, boot_h=0.12, hem=0.04),
        shirt="#4E6380", trousers="#8A7A5C", boots=("#34302C", 0.4), helmet="#E2732C", helmet_scuff=0.5,
        hair=dict(brow_w=1.0, moustache=0.7, moustache_h=0.011)),
    "worker_mason": dict(
        tone="#584034", sss=0.0022, red=0.1, stubble=0.95, grey=0.6, dust=0.35, tex=1024, budget=25000,
        macro=dict(gender=1.0, age=0.692, muscle=0.62, weight=0.32, height=0.30, proportions=0.55,
                   race={"asian": 0.12, "caucasian": 0.48, "african": 0.40}),
        details={"nose/nose-hump-incr": 0.35, "nose/nose-flaring-incr": 0.55, "nose/nose-point-down": 0.3,
                 "mouth/mouth-lowerlip-volume-incr": 0.2, "eyes/l-eye-bag-incr": 0.6, "eyes/r-eye-bag-incr": 0.55,
                 "cheek/l-cheek-volume-decr": 0.45, "cheek/r-cheek-volume-decr": 0.5, "head/head-age-incr": 0.5,
                 "chin/chin-prominent-incr": 0.2, "head/head-rectangular": 0.3, "forehead/forehead-temple-decr": 0.3,
                 "eyebrows/eyebrows-angle-down": 0.3, "mouth/mouth-laugh-lines-in": 0.4},
        cloth=dict(tuck=0.05, sleeve="half", strap_x=0.0, boot_h=0.24, hem=0.19),
        shirt="#E3DCCB", trousers="#5C4A36", boots=("#161616", 0.3), helmet="#E8E6DE", helmet_scuff=0.7,
        hair=dict(brow_w=1.25, moustache=1.15, moustache_h=0.017, brow_grey=0.5)),
    "worker_plaster": dict(
        tone="#7A5A46", sss=0.0026, red=0.18, stubble=0.6, grey=0.0, dust=0.55, tex=1024, budget=25000,
        macro=dict(gender=1.0, age=0.57, muscle=0.72, weight=0.45, height=0.40, proportions=0.55,
                   race={"asian": 0.2, "caucasian": 0.42, "african": 0.38}),
        details={"nose/nose-scale-depth-decr": 0.2, "nose/nose-flaring-incr": 0.25, "head/head-round": 0.35,
                 "mouth/mouth-upperlip-volume-incr": 0.2, "chin/chin-width-incr": 0.3, "eyebrows/eyebrows-trans-down": 0.3,
                 "cheek/l-cheek-volume-incr": 0.2, "cheek/r-cheek-volume-incr": 0.2, "neck/neck-scale-horiz-incr": 0.25},
        cloth=dict(tuck=0.05, sleeve="half", strap_x=0.075, boot_h=0.24, hem=0.19, neck="crew"),
        shirt="#8E8D88", trousers="#6E6A64", boots=("#22262A", 0.3), helmet="#2F6DB5", helmet_scuff=0.55,
        hair=dict(brow_w=1.05, moustache=0.0)),
}
CFG = CFGS[ROLE]
CFG["details"] = {k: v for k, v in CFG["details"].items() if v}

# =================================================================== body + rig
clean_scene()
bpy.context.scene.render.fps = FPS
bm, rig = make_human(dict(CFG["macro"]), CFG["details"])
coll = get_coll(ROLE.upper())
move_to(bm, coll); move_to(rig, coll)
bm.name = "body"; rig.name = ROLE + "_rig"; rig.data.name = ROLE + "_skeleton"
log("height", round(bm.dimensions.z, 3))
info = face_info(bm)
dom = dominant_bones(bm, rig)
regions, belt_z, clav_z, ankle_z = classify_web(bm, rig, CFG["cloth"])
adj = adjacency(bm.data)
covered = set()
for r in regions.values():
    covered |= shrink(r, adj, 2)

# =================================================================== clothes (rest pose)
slv = CFG["cloth"]["sleeve"]
dirt = 0.12 if ROLE == "builder" else 0.4
shirt_mat = shirt_material("shirt", CFG["shirt"], rig, clav_z, belt_z, dust=0.18 if ROLE == "builder" else 0.6,
                           sweat=0.2 if ROLE == "builder" else 0.4, placket=(slv != "none" and CFG["cloth"].get("neck") != "crew"), dirt=dirt, plain_vest=(slv == "none"))
tr_mat = trousers_material("trousers", CFG["trousers"], belt_z, rig.data.bones["calf_l"].head_local.z,
                          dust=0.18 if ROLE == "builder" else 0.4)
boot_mat = leather_material("boots", CFG["boots"][0], rough=CFG["boots"][1], dust=0.2 if ROLE == "builder" else 0.3, sole_z=0.006)
belt_mat = leather_material("belt", "#2A1A10", rough=0.4, dust=0.05)

def shirt_off(c):
    torso = abs(c.x) < 0.15
    return (0.004 + 0.008 * max(0.0, min(1.0, (belt_z + 0.20 - c.z) / 0.20))) if torso else 0.0
shirt = shell(bm, rig, regions["shirt"], "shirt", coll, 0.007, 16, shirt_mat, min_gap=0.004,
              extra_offset=shirt_off, post_smooth=10, hidden=covered)
trs = shell(bm, rig, regions["trousers"], "trousers", coll, 0.022 if ROLE == "builder" else 0.024, 22, tr_mat, min_gap=0.006,
            post_smooth=10, hidden=covered,
            extra_offset=lambda c: 0.016 * max(0.0, 1 - (c.z - ankle_z) / 0.45) + 0.004 * max(0.0, 1 - abs(c.z - (belt_z - 0.25)) / 0.2) + 0.006 * max(0.0, 1 - abs(c.z - belt_z) / 0.08))
boots = shell(bm, rig, regions["boots"], "boots", coll, 0.014 if CFG["cloth"]["boot_h"] < 0.2 else 0.012, 20, boot_mat,
              min_gap=0.005, hidden=covered)
loosen_trousers(trs, rig, belt_z, r_top=0.102 if ROLE == "builder" else 0.096, r_bot=0.086 if CFG["cloth"]["boot_h"] < 0.2 else 0.078)
for ob, ratio in ((shirt, 1.0 if (ROLE == "builder" or slv == "none") else 0.7), (trs, 0.8 if ROLE == "builder" else 0.5)):
    if ratio < 1.0:
        dec = ob.modifiers.new("Dec", 'DECIMATE'); dec.ratio = ratio; dec.use_symmetry = True
        apply_mod(ob, "Dec")
hull_fit(boots, 0.004, 8)
SOLE = 0.018
for v in boots.data.vertices:
    if v.co.z < 0.02:
        v.co.z = -SOLE + max(0.0, v.co.z) * 0.15

def mean(l, ob, k): return sum(ob.data.vertices[i].co[k] for i in l) / len(l)
loops = boundary_loops(shirt)
neck_loop = max(loops, key=lambda l: mean(l, shirt, 2))
nc = Vector((0, mean(neck_loop, shirt, 1), 0))
def rad(co): return Vector((co.x - nc.x, co.y - nc.y, 0)).normalized()
if slv != "none" and CFG["cloth"].get("neck") == "crew":
    extrude_rings(shirt, neck_loop, [lambda co: co + rad(co) * 0.0025, lambda co: co - Z * 0.012, lambda co: co - rad(co) * 0.003])
if slv != "none":
  if CFG["cloth"].get("neck") != "crew":
    # full turn-down collar around the neck; tips meet at the top button
    def fr(co): return max(0.0, -rad(co).y) ** 4
    extrude_rings(shirt, neck_loop, [
        lambda co: co + Z * 0.027 + rad(co) * 0.002,
        lambda co: co + rad(co) * 0.007 + Z * 0.002,
        lambda co: co + rad(co) * (0.009 + 0.010 * fr(co)) - Z * (0.035 + 0.030 * fr(co)) + Vector((-co.x * 0.3 * fr(co), 0, 0)),
    ], skip=lambda co: co.y < nc.y - 0.02 and abs(co.x) < 0.006)
  for side in ("_l", "_r"):
        bn = ("upperarm" if slv == "half" else "lowerarm") + side
        b = rig.data.bones[bn]
        A = (b.tail_local - b.head_local).normalized()
        cand = [l for l in boundary_loops(shirt) if (mean(l, shirt, 0) > 0.15 if side == "_l" else mean(l, shirt, 0) < -0.15)]
        if not cand: continue
        sl = max(cand, key=lambda l: abs(mean(l, shirt, 0)))
        def ar(co, A=A, h=b.head_local):
            p = co - h; return (p - A * p.dot(A)).normalized()
        if slv == "rolled":
            rings = [lambda co, A=A, ar=ar: co + ar(co) * 0.006 - A * 0.002,
                     lambda co, A=A, ar=ar: co - A * 0.040 + ar(co) * 0.002,
                     lambda co, A=A, ar=ar: co - ar(co) * 0.007]
        else:  # stitched hem / cuff
            rings = [lambda co, A=A, ar=ar: co + ar(co) * 0.0025,
                     lambda co, A=A, ar=ar: co - A * (0.028 if slv == "full" else 0.015),
                     lambda co, A=A, ar=ar: co - ar(co) * 0.003]
        extrude_rings(shirt, sl, rings)
else:
    for l in boundary_loops(shirt):
        if mean(l, shirt, 2) > belt_z + 0.15:
            extrude_rings(shirt, l, [lambda co: co + (co - Vector((0, nc.y, co.z))).normalized() * 0.0018,
                                     lambda co: co - Z * 0.006])
tl = boundary_loops(trs)
top = max(tl, key=lambda l: mean(l, trs, 2))
trs.data.materials.append(belt_mat)
tc = Vector((0, mean(top, trs, 1), 0))
def trad(co): return Vector((co.x - tc.x, co.y - tc.y, 0)).normalized()
extrude_rings(trs, top, [lambda co: co + trad(co) * 0.004, lambda co: co - Z * 0.034,
                         lambda co: co - trad(co) * 0.004], mat_index=1)
for ob, wr in ((shirt, 0.0024), (trs, 0.0028), (boots, 0.0)):
    if wr:
        tex = bpy.data.textures.new(ob.name + "_wr", 'CLOUDS'); tex.noise_scale = 0.05; tex.noise_depth = 2
        d = ob.modifiers.new("Wrinkles", 'DISPLACE'); d.texture = tex; d.strength = wr; d.texture_coords = 'LOCAL'
        apply_mod(ob, "Wrinkles")
    a = ob.modifiers.new("Armature", 'ARMATURE'); a.object = rig
    ob.parent = rig
    for m in ob.data.materials: m.use_backface_culling = False
dec = boots.modifiers.new("Dec", 'DECIMATE'); dec.ratio = 0.45
boots.modifiers.move(len(boots.modifiers) - 1, 0); apply_mod(boots, "Dec")

# helmet (web: lower poly, three ridges, peak)
def helmet_web():
    hc = info["head_c"]; hs = info["scalp_size"]
    rx = hs.x / 2 + 0.016; ry = hs.y / 2 + 0.018; rz = hs.z * 0.62 + 0.012
    bmh = bmesh.new()
    bmesh.ops.create_uvsphere(bmh, u_segments=48, v_segments=24, radius=1.0)
    for v in list(bmh.verts):
        if v.co.z < -0.02: bmh.verts.remove(v)
    for v in bmh.verts:
        x, y, z = v.co.x * rx, v.co.y * ry, max(v.co.z, 0) * rz
        if z > rz * 0.3:
            k = min(1.0, z / rz)
            z += 0.0075 * math.exp(-(x / 0.011) ** 2) * k
            z += 0.0045 * (math.exp(-((x - 0.042) / 0.008) ** 2) + math.exp(-((x + 0.042) / 0.008) ** 2)) * k * max(0, -y / ry + 0.3)
        v.co = Vector((x, y, z))
    ret = bmesh.ops.extrude_edge_only(bmh, edges=[e for e in bmh.edges if e.is_boundary])
    for g in ret["geom"]:
        if isinstance(g, bmesh.types.BMVert):
            h = Vector((g.co.x, g.co.y, 0)).normalized(); front = max(0.0, -h.y) ** 2.5
            g.co += h * (0.007 + 0.038 * front) + Vector((0, 0, -0.003 - 0.010 * front))
    ret = bmesh.ops.extrude_edge_only(bmh, edges=[e for e in bmh.edges if e.is_boundary])
    for g in ret["geom"]:
        if isinstance(g, bmesh.types.BMVert): g.co.z -= 0.005
    me = bpy.data.meshes.new("helmet"); bmh.to_mesh(me); bmh.free()
    for pg in me.polygons: pg.use_smooth = True
    me.materials.append(plastic_material("helmet", CFG["helmet"], rough=0.28, scuff=CFG["helmet_scuff"],
                                         dirt=0.06 if ROLE == "builder" else 0.4))
    ob = bpy.data.objects.new("helmet", me); coll.objects.link(ob)
    ob.location = Vector((0, hc.y + 0.004, info["eye_l"].z + 0.036)); ob.rotation_euler = (math.radians(-6), 0, 0)
    s = ob.modifiers.new("Shell", 'SOLIDIFY'); s.thickness = 0.0035; s.offset = 1.0
    upd()
    return ob
helmet = helmet_web()
rigid_to_bone(helmet, rig, "head")
helmet.parent = rig

# =================================================================== skin, morphs, strip
write_masks(bm, rig, info, beard=True)
write_hair_masks(bm, info, CFG["hair"])
skin = skin_material_web("skin_src", CFG["tone"], sss_scale=CFG["sss"], red_amt=CFG["red"], stubble=CFG["stubble"],
                         grey=CFG["grey"], dust=CFG["dust"], brow_grey=CFG["hair"].get("brow_grey", 0.0))
teeth_m = gltf_mat("teeth", base_col=srgb("#D9CDB4"), rough=0.3)
tongue_m = gltf_mat("mouth", base_col=srgb("#6E3430"), rough=0.4)
me = bm.data
me.materials.clear()
for m in (skin, teeth_m, tongue_m): me.materials.append(m)
teeth = vg_set(bm, "helper-upper-teeth") | vg_set(bm, "helper-lower-teeth")
tongue = vg_set(bm, "helper-tongue")
for pg in me.polygons:
    vs = set(pg.vertices)
    pg.material_index = 1 if vs <= teeth else 2 if vs <= tongue else 0
    pg.use_smooth = True
dense = bm.vertex_groups.new(name="dense")
hv = [i for i, d in enumerate(dom) if d in ("head", "neck_01")]
hd = [i for i, d in enumerate(dom) if d and any(d.startswith(f) for f in ("hand", "thumb", "index", "middle", "ring", "pinky"))]
dense.add(hv, 1.0, 'REPLACE'); dense.add(hd, 0.9, 'REPLACE')
add_expression_keys(bm, EXPR)
keep = (vg_set(bm, "body") - covered) | teeth | tongue
for m in list(bm.modifiers):
    if m.type != 'ARMATURE': bm.modifiers.remove(m)
delete_verts(bm, keep)
bm.parent = rig
log("body tris after strip", tri_count(bm))

# =================================================================== bake skin (rest pose)
rig.data.pose_position = 'REST'
setup_cycles(4)
S = CFG["tex"]
dummy = new_img("dummy", 32)
for m in (teeth_m, tongue_m):
    n = m.node_tree.nodes.new("ShaderNodeTexImage"); n.image = dummy; n.name = "DUMMY"; m.node_tree.nodes.active = n
def bake_skin(btype, img, **kw):
    for m in (teeth_m, tongue_m):
        m.node_tree.nodes.active = m.node_tree.nodes["DUMMY"]
    bake([bm], btype, img, mats=[skin], **kw)
alb = new_img("skin_albedo", S); bake_skin('DIFFUSE', alb, pass_filter={'COLOR'}); warm_albedo(alb); save_img(alb, ROLE)
rgh = new_img("skin_rough", S // 2, non_color=True); bake_skin('ROUGHNESS', rgh); save_img(rgh, ROLE)
nrm = new_img("skin_normal", S, non_color=True); bake_skin('NORMAL', nrm); save_img(nrm, ROLE)
ha = new_img("hair_alpha", S, non_color=True); bake_skin('EMIT', ha, emit_node="HAIR_ALPHA"); save_img(ha, ROLE)
rgba = new_img("hair_rgba", S, alpha=True)
a_ = np.array(alb.pixels[:]).reshape(-1, 4); h_ = np.array(ha.pixels[:]).reshape(-1, 4)
a_[:, 3] = np.clip(h_[:, 0], 0, 1); rgba.pixels = a_.ravel().tolist(); save_img(rgba, ROLE)
for m in (teeth_m, tongue_m):
    m.node_tree.nodes.remove(m.node_tree.nodes["DUMMY"])
log("skin baked")
skin_final = gltf_mat("skin", base_img=alb, rough_img=rgh, normal_img=nrm)
shell_m = gltf_mat("hair", base_img=rgba, use_alpha=True, rough=0.5, double=True)
me.materials[0] = skin_final
me.materials.append(shell_m)

# =================================================================== eyes + eye bones
add_eye_bones(rig, info)
eyes, cornea, eye_img = eye_meshes(info, rig, coll)

# =================================================================== outfit atlas
outfit = join([shirt, trs, boots, helmet], "outfit")
smart_uv(outfit, margin=0.003)
ot = bake_set([outfit], ROLE, "outfit", 1024)
outfit.data.materials.clear()
outfit.data.materials.append(gltf_mat("outfit", base_img=ot["albedo"], rough_img=ot["rough"], normal_img=ot["normal"], double=True))
for pg in outfit.data.polygons: pg.material_index = 0
log("outfit baked, tris", tri_count(outfit))

# =================================================================== props
def box(name, dims, bevel=0.002, seg=2):
    bmh = bmesh.new(); bmh.loops.layers.uv.new("UVMap"); bmesh.ops.create_cube(bmh, size=1.0, calc_uvs=True)
    for v in bmh.verts: v.co = Vector((v.co.x * dims[0], v.co.y * dims[1], v.co.z * dims[2]))
    me_ = bpy.data.meshes.new(name); bmh.to_mesh(me_); bmh.free()
    ob = bpy.data.objects.new(name, me_); coll.objects.link(ob)
    if bevel:
        b = ob.modifiers.new("B", 'BEVEL'); b.width = bevel; b.segments = seg
        apply_mod(ob, "B")
    return ob

def cyl(bmh, p0, p1, r0, r1, seg=16):
    d = p1 - p0; L = d.length
    ret = bmesh.ops.create_cone(bmh, cap_ends=True, segments=seg, radius1=r0, radius2=r1, depth=L, calc_uvs=False)
    vs = ret["verts"]
    R = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix()
    bmesh.ops.rotate(bmh, verts=vs, matrix=R)
    bmesh.ops.translate(bmh, verts=vs, vec=(p0 + p1) / 2)
    return vs

def mesh_from(bmh, name, mats, mat_of=None):
    me_ = bpy.data.meshes.new(name); bmh.to_mesh(me_); bmh.free()
    for m in mats: me_.materials.append(m)
    if mat_of:
        for pg in me_.polygons: pg.material_index = mat_of(pg)
    for pg in me_.polygons: pg.use_smooth = True
    ob = bpy.data.objects.new(name, me_); coll.objects.link(ob)
    return ob

wood = gltf_mat("wood", base_col=srgb("#7A4E2A"), rough=0.62)
steel = gltf_mat("steel", base_col=(0.55, 0.55, 0.56, 1), rough=0.45, metal=1.0)
mortar_m = gltf_mat("mortar", base_col=srgb("#8E8B84"), rough=0.95)

def brick_obj(name):
    ob = box(name, (0.23, 0.11, 0.075), bevel=0.004)
    m = bpy.data.materials.new("brick_src"); nb = NB(m)
    P = nb.n("ShaderNodeTexCoord").outputs["Object"]
    n1 = nb.noise(P, 60.0, 6.0, 0.6); n2 = nb.noise(P, 8.0, 4.0, 0.5)
    c = nb.mixc('MIX', nb.maprange(n2, 0.3, 0.7), srgb("#8E4A32"), srgb("#B0603E"))
    c = nb.mixc('MULTIPLY', nb.maprange(n1, 0.4, 0.7, 0.0, 0.35), c, (0.6, 0.55, 0.5, 1))
    p = principled(nb, Base_Color=c, Roughness=0.88); nb.out(p.outputs[0])
    ob.data.materials.append(m)
    bake_prop(ob, ROLE, 256, rough=0.88)
    return ob

def blob(name, r, flat=0.45, seg=10):
    bmh = bmesh.new(); bmesh.ops.create_uvsphere(bmh, u_segments=seg, v_segments=seg // 2 + 2, radius=r)
    for v in bmh.verts: v.co.z *= flat
    return mesh_from(bmh, name, [mortar_m])

def parent_bone(ob, bone):
    upd(); mw = ob.matrix_world.copy()
    ob.parent = rig; ob.parent_type = 'BONE'; ob.parent_bone = bone
    upd(); ob.matrix_world = mw

def key_scale(ob, frames_vals, clip):
    ob.animation_data_create(); ob.animation_data.action = None
    for f, v in frames_vals:
        ob.scale = (v, v, v) if v > 0 else (0.0001, 0.0001, 0.0001)
        ob.keyframe_insert("scale", frame=f)
    act = ob.animation_data.action
    try:
        for fc in act.layers[0].strips[0].channelbags[0].fcurves:
            for kp in fc.keyframe_points: kp.interpolation = 'CONSTANT'
    except Exception:
        for fc in getattr(act, "fcurves", []):
            for kp in fc.keyframe_points: kp.interpolation = 'CONSTANT'
    push_nla(ob, clip)

rig.data.pose_position = 'POSE'
P = Poser(rig, sole=SOLE)
props = []
CLIPS = []

def plant(P, ankles=None, yaw=(0.0, 0.0)):
    a = ankles or P.ankle
    P.leg("_l", a["_l"], yaw[0]); P.leg("_r", a["_r"], yaw[1])

if ROLE == "builder":
    # ---------------- generic tablet (no logo): slab + bezel + screen UI (emissive texture)
    W, H, T = 0.247, 0.178, 0.0066
    bmh = bmesh.new(); bmesh.ops.create_cube(bmh, size=1.0)
    for v in bmh.verts: v.co = Vector((v.co.x * W, v.co.y * H, v.co.z * T))
    bmh.faces.ensure_lookup_table()
    topf = max(bmh.faces, key=lambda f: f.calc_center_median().z)
    bmesh.ops.inset_individual(bmh, faces=[topf], thickness=0.011, depth=-0.0003)
    uvl = bmh.loops.layers.uv.new("UVMap")
    for f in bmh.faces:
        for l in f.loops: l[uvl].uv = (l.vert.co.x / (W - 0.022) + 0.5, l.vert.co.y / (H - 0.022) + 0.5)
    ui = np.zeros((384, 512, 4), np.float32); ui[..., 3] = 1
    def rect(x0, y0, x1, y1, col):
        ui[int(y0 * 384):int(y1 * 384), int(x0 * 512):int(x1 * 512), :3] = col
    lin = lambda h: np.array(srgb(h)[:3], np.float32)
    rect(0, 0, 1, 1, lin("#0F1A20")); rect(0, 0.88, 1, 1, lin("#1B2A33"))
    rect(0.04, 0.12, 0.60, 0.80, lin("#1B2A33")); rect(0.06, 0.62, 0.40, 0.74, lin("#FCD301"))
    for k in range(5): rect(0.06, 0.18 + k * 0.08, 0.06 + 0.1 * (k + 2), 0.22 + k * 0.08, lin("#47C13C") * 0.8)
    for k in range(4): rect(0.65, 0.66 - k * 0.15, 0.96, 0.76 - k * 0.15, lin("#F7F4EB") * 0.35)
    uimg = bpy.data.images.new("tablet_ui", 512, 384); uimg.pixels = ui.ravel().tolist(); save_img(uimg, ROLE)
    body_m = gltf_mat("tablet_body", base_col=(0.16, 0.165, 0.17, 1), rough=0.35, metal=1.0)
    bez_m = gltf_mat("tablet_glass", base_col=(0.01, 0.01, 0.011, 1), rough=0.06)
    scr_m = gltf_mat("tablet_screen", base_col=(0.02, 0.02, 0.02, 1), rough=0.08, emit_img=uimg, emit_strength=1.0)
    def tmat(pg):
        if pg.normal.z > 0.9:
            return 2 if (abs(pg.center.x) < W / 2 - 0.012 and abs(pg.center.y) < H / 2 - 0.012) else 1
        return 0
    tab = mesh_from(bmh, "tablet", [body_m, bez_m, scr_m], tmat)
    for pg in tab.data.polygons: pg.use_smooth = False
    def tframe(C, phi):
        N = Vector((0, math.sin(phi), math.cos(phi)))
        return frame_from_axes(C, -X, N)
    sh = (head_of(rig, "upperarm_l") + head_of(rig, "upperarm_r")) / 2
    C_view = Vector((0.0, sh.y - 0.31, sh.z - 0.30)); PHI_V = math.radians(30)
    C_idle = Vector((0.0, sh.y - 0.25, sh.z - 0.43)); PHI_I = math.radians(12)
    POLE = {"_l": Vector((0.35, 0.3, -0.5)), "_r": Vector((-0.35, 0.3, -0.5))}
    # calibrate grip at the viewing pose
    P.begin(); P.pelvis(Vector((0, 0, -0.012))); plant(P)
    tab.matrix_world = tframe(C_view, PHI_V); upd()
    tbvh = obj_bvh(tab)
    Nv = Vector((0, math.sin(PHI_V), math.cos(PHI_V))); Uv = Vector((0, -math.cos(PHI_V), math.sin(PHI_V)))
    for s, sg in (("_l", 1), ("_r", -1)):
        d_ = (Uv * 0.85 - X * sg * 0.45).normalized()
        pc = C_view + X * sg * (W / 2 - 0.040) - Uv * (H / 2 - 0.035) - Nv * (T / 2 + 0.0125)
        place_hand(rig, s, pc, d_, Nv, head_of(rig, "upperarm" + s) + POLE[s], palm_off=0.0125)
        for f in ("index", "middle", "ring", "pinky"):
            curl_finger(rig, s, f, [tbvh], maxdeg=(30, 40, 30), mindeg=(4, 6, 4))
        E = C_view + X * sg * (W / 2) - Uv * (H / 2 - 0.055); front = Nv * (T / 2 + 0.0085)
        aim_chain(rig, ["thumb_01" + s, "thumb_02" + s, "thumb_03" + s],
                  [E + X * sg * 0.014 - Nv * 0.004, E + front + X * sg * 0.004, E + front - X * sg * 0.035 + Uv * 0.012])
    GR = record_grip(rig, "_r", tab); GL = record_second(rig, "_l", tab)
    parent_bone(tab, "hand_r"); props.append(tab)

    def hold_tablet(P, C, phi):
        Tm = tframe(C, phi)
        P.hand("_r", Tm @ GR["M"].inverted(), head_of(rig, "upperarm_r") + POLE["_r"])
        Ta = bw(rig, "hand_r") @ GR["M"]
        P.hand("_l", Ta @ GL["M"], head_of(rig, "upperarm_l") + POLE["_l"])
        P.fingers({**GR["fingers"], **GL["fingers"]})

    LOOKS = [(0.0, Vector((-1.6, -4.0, 2.4))), (0.5, Vector((-1.6, -4.0, 2.4))), (1.5, Vector((1.8, -4.2, 1.9))),
             (2.2, Vector((1.8, -4.2, 1.9))), (3.0, Vector((0.3, -2.6, 0.9))), (3.4, Vector((0.3, -2.6, 0.9))),
             (4.0, Vector((-1.6, -4.0, 2.4)))]
    def idle_pose(P, t):
        w = 2 * math.pi * t / 4.0
        P.pelvis(Vector((0.011 * math.sin(w), 0.0, -0.014 - 0.002 * (1 - math.cos(2 * w)) / 2)), roll=1.2 * math.sin(w), yaw=2.0 * math.sin(w))
        plant(P)
        P.spine(pitch=2.0 + 0.9 * math.sin(2 * w), yaw=3.0 * math.sin(w + 0.6))
        P.shoulders(drop=0.8 * math.sin(2 * w))
        lt = track(LOOKS, t); et = track(LOOKS, (t + 0.18) % 4.0)
        P.look(lt, et)
        hold_tablet(P, C_idle + Vector((0, 0, 0.004 * math.sin(2 * w))), PHI_I)
    n = bake_clip(P, "idle_inspect", 4.0, idle_pose, loop=True)
    push_nla(rig, "idle_inspect"); CLIPS.append(("idle_inspect", n))
    log("clip idle_inspect")

    BACK = 0.21
    def step_pose(P, t):
        w0 = 0.0
        sx = track([(0.0, 0.0), (0.35, 0.026), (0.75, 0.0), (1.15, -0.018), (1.8, 0.004), (4.0, 0.004)], t)
        sy = track([(0.0, 0.0), (0.4, 0.0), (1.15, BACK * 0.5), (1.8, BACK * 0.5), (4.0, BACK * 0.5)], t)
        sz = track([(0.0, -0.014), (0.8, -0.03), (1.4, -0.018), (4.0, -0.016)], t)
        P.pelvis(Vector((sx, sy, sz)), roll=track([(0, 0), (0.35, 1.5), (1.15, -1.0), (1.8, 0.0), (4, 0)], t))
        s = max(0.0, min(1.0, (t - 0.4) / 0.6)); e = ease(s)
        ar = P.ankle["_r"] + Vector((0, BACK * e, 0.045 * math.sin(math.pi * s)))
        P.leg("_l", P.ankle["_l"], 0.0)
        P.leg("_r", ar, -4.0 * e, toe_pitch=-12 * math.sin(math.pi * s))
        P.spine(pitch=track([(0, 2.0), (1.0, 0.0), (1.8, 4.0), (3.0, 3.0), (3.4, 0.5), (4.0, 0.5)], t))
        P.shoulders(drop=track([(0, 0), (3.2, 0.0), (3.7, 2.2), (4.0, 2.0)], t))
        C = track([(0.0, C_idle), (0.6, C_idle + Vector((0, sy, 0))), (1.5, C_view + Vector((0, BACK * 0.5, 0))), (4.0, C_view + Vector((0, BACK * 0.5, 0)))], t)
        phi = track([(0.0, PHI_I), (0.6, PHI_I), (1.5, PHI_V), (4.0, PHI_V)], t)
        Nn = Vector((0, math.sin(phi), math.cos(phi)))
        scan = C + Nn * 0.01 + X * 0.05 * math.sin((t - 1.5) * 3.2) * (1.0 if 1.6 < t < 2.8 else 0.0)
        up = Vector((0.2, -5.0, 3.6))
        lt = track([(0.0, Vector((-1.6, -4.0, 2.4))), (0.5, Vector((0.0, -5.0, 3.2))), (1.25, C), (2.75, C), (3.3, up), (4.0, up)], t)
        et = track([(0.0, Vector((-1.6, -4.0, 2.4))), (0.4, Vector((0.0, -5.0, 3.2))), (1.15, scan), (2.7, scan), (3.15, up), (4.0, up)], t)
        P.look(lt, et)
        hold_tablet(P, C, phi)
    kb = bm.data.shape_keys.key_blocks
    bm.data.shape_keys.animation_data_create(); bm.data.shape_keys.animation_data.action = None
    def smile_key(f, t):
        kb["smile"].value = 0.75 * ease((t - 3.0) / 0.8)
        kb["smile"].keyframe_insert("value", frame=f)
    n = bake_clip(P, "step_back_tablet", 4.0, step_pose, extra_key=smile_key, loop=False)
    push_nla(rig, "step_back_tablet"); push_nla(bm.data.shape_keys, "step_back_tablet")
    kb["smile"].value = 0.0
    CLIPS.append(("step_back_tablet", n))
    log("clip step_back_tablet")

elif ROLE == "worker_shutter":
    # ---------------- weathered shuttering plywood 0.6 x 0.9 x 12 mm
    PW, PH, PT = 0.60, 0.90, 0.012
    pan = box("plywood_panel", (PW, PH, PT), bevel=0.0015)
    m = bpy.data.materials.new("ply_src"); nb = NB(m)
    Pc = nb.n("ShaderNodeTexCoord").outputs["Object"]
    wv = nb.n("ShaderNodeTexWave", wave_type='BANDS', bands_direction='X'); nb.l(Pc, wv.inputs["Vector"])
    wv.inputs["Scale"].default_value = 6.0; wv.inputs["Distortion"].default_value = 8.0; wv.inputs["Detail"].default_value = 3.0
    c = nb.mixc('MIX', nb.maprange(wv.outputs["Fac"], 0.2, 0.9), srgb("#9C7A52"), srgb("#B89468"))
    stain = nb.maprange(nb.noise(Pc, 5.0, 8.0, 0.65), 0.45, 0.7)
    c = nb.mixc('MIX', nb.math('MULTIPLY', stain, 0.8), c, srgb("#7E7A72"))
    c = nb.mixc('MULTIPLY', nb.maprange(nb.noise(Pc, 30.0, 6.0, 0.6), 0.5, 0.75, 0.0, 0.4), c, (0.55, 0.5, 0.45, 1))
    p = principled(nb, Base_Color=c, Roughness=0.85); nb.out(p.outputs[0])
    pan.data.materials.append(m)
    bake_prop(pan, ROLE, 512, rough=0.85)
    def pframe(C, tilt=0.0, yaw=0.0):
        R = Matrix.Rotation(math.radians(yaw), 3, 'Z') @ Matrix.Rotation(math.radians(tilt), 3, 'X')
        return frame_from_axes(C, R @ X, R @ Y)
    POLE = {"_l": Vector((0.45, 0.25, -0.35)), "_r": Vector((-0.45, 0.25, -0.35))}
    C_cal = Vector((0.0, -0.31, 0.98))
    P.begin(); P.pelvis(Vector((0, 0, -0.015))); plant(P)
    pan.matrix_world = pframe(C_cal); upd()
    pbvh = obj_bvh(pan)
    for s, sg in (("_l", 1), ("_r", -1)):
        d_ = (-X * sg * 0.9 + Z * 0.3).normalized()
        pc = C_cal + X * sg * (PW / 2 - 0.035) - Y * (PT / 2 + 0.006)
        place_hand(rig, s, pc, d_, Y, head_of(rig, "upperarm" + s) + POLE[s], palm_off=0.012)
        for f in ("index", "middle", "ring", "pinky"):
            curl_finger(rig, s, f, [pbvh], maxdeg=(25, 30, 25), mindeg=(3, 5, 4))
        E = C_cal + X * sg * (PW / 2) + Y * (PT / 2 + 0.0085)
        aim_chain(rig, ["thumb_01" + s, "thumb_02" + s, "thumb_03" + s],
                  [C_cal + X * sg * (PW / 2 + 0.012) + Z * 0.035, E + Z * 0.045 - X * sg * 0.008, E + Z * 0.05 - X * sg * 0.045])
    GR = record_grip(rig, "_r", pan); GL = record_second(rig, "_l", pan)
    parent_bone(pan, "hand_r"); props.append(pan)
    STEP = 0.19
    C0 = Vector((0.0, -0.30, 0.96)); C1 = Vector((0.0, -0.43, 0.99)); C2 = Vector((0.0, -0.45, 0.99))
    def shutter_pose(P, t):
        s = max(0.0, min(1.0, (t - 0.15) / 0.6)); r = max(0.0, min(1.0, (t - 3.2) / 0.6))
        step = ease(s) - ease(r)
        lift = 0.04 * (math.sin(math.pi * s) if 0 < s < 1 else 0) + 0.04 * (math.sin(math.pi * r) if 0 < r < 1 else 0)
        fwd = track([(0, 0.0), (0.2, 0.0), (0.9, -0.085), (2.0, -0.10), (3.0, -0.085), (3.9, 0.0), (4.0, 0.0)], t)
        sx = track([(0, 0.0), (0.2, -0.02), (0.9, 0.015), (2.0, 0.01), (3.2, -0.02), (3.9, 0.0), (4, 0)], t)
        P.pelvis(Vector((sx, fwd, -0.02 - 0.012 * step)), pitch=4.0 * step)
        P.leg("_l", P.ankle["_l"] + Vector((0, -STEP * step, lift)), 0.0, toe_pitch=-10 * lift / 0.04)
        P.leg("_r", P.ankle["_r"], -3.0)
        P.spine(pitch=track([(0, 3), (0.9, 8), (1.6, 9), (2.0, 6), (2.8, 6), (3.9, 3), (4, 3)], t),
                yaw=track([(0, 0), (2.0, 0), (2.3, -6), (2.6, 6), (2.8, 0), (4, 0)], t))
        C = track([(0.0, C0), (0.3, C0), (1.0, C1), (1.3, C2), (1.6, C2 + Vector((0.025, 0, 0))),
                   (1.95, C2 + Vector((0.012, 0, -0.008))), (2.8, C2 + Vector((0.012, 0, -0.008))),
                   (3.15, C1), (3.9, C0), (4.0, C0)], t)
        tilt = track([(0, 10.0), (0.3, 10.0), (1.0, 0.0), (3.15, 0.0), (3.9, 10.0), (4, 10.0)], t)
        Pm = pframe(C, tilt)
        P.hand("_r", Pm @ GR["M"].inverted(), head_of(rig, "upperarm_r") + POLE["_r"])
        Pa = bw(rig, "hand_r") @ GR["M"]
        P.hand("_l", Pa @ GL["M"], head_of(rig, "upperarm_l") + POLE["_l"])
        P.fingers({**GR["fingers"], **GL["fingers"]})
        edgeL = C + X * 0.30 + Z * 0.42; edgeR = C - X * 0.30 + Z * 0.42
        lt = track([(0, C + Z * 0.1), (1.3, C + Z * 0.15), (2.05, edgeL), (2.45, edgeR), (2.8, C + Z * 0.3), (3.4, C), (4, C + Z * 0.1)], t)
        P.look(lt, lt)
    kb = bm.data.shape_keys.key_blocks
    bm.data.shape_keys.animation_data_create(); bm.data.shape_keys.animation_data.action = None
    def conc(f, t):
        kb["concentrate"].value = 0.15 + 0.3 * ease((t - 1.8) / 0.4) * (1 - ease((t - 2.9) / 0.4))
        kb["concentrate"].keyframe_insert("value", frame=f)
    n = bake_clip(P, "place_panel", 4.0, shutter_pose, extra_key=conc, loop=True)
    push_nla(rig, "place_panel"); push_nla(bm.data.shape_keys, "place_panel"); kb["concentrate"].value = 0
    CLIPS.append(("place_panel", n))

elif ROLE == "worker_mason":
    # ---------------- trowel (pointed Indian pattern), brick, mortar; context: mortar pan + brick stack
    bmh = bmesh.new()
    cyl(bmh, Vector((0, 0, 0)), Vector((0.115, 0, 0)), 0.0135, 0.0115, 14)
    cyl(bmh, Vector((0.115, 0, 0)), Vector((0.131, 0, 0)), 0.0118, 0.009, 14)
    cyl(bmh, Vector((0.130, 0, 0)), Vector((0.150, 0, -0.012)), 0.0035, 0.0035, 8)
    cyl(bmh, Vector((0.150, 0, -0.012)), Vector((0.165, 0, -0.045)), 0.0035, 0.0035, 8)
    pts = [(0.16, 0.0), (0.175, 0.055), (0.24, 0.05), (0.30, 0.03), (0.36, 0.0), (0.30, -0.03), (0.24, -0.05), (0.175, -0.055)]
    top = [bmh.verts.new((x, y, -0.047)) for x, y in pts]; bot = [bmh.verts.new((x, y, -0.0486)) for x, y in pts]
    bmh.faces.new(top); bmh.faces.new(list(reversed(bot)))
    for i in range(len(pts)):
        j = (i + 1) % len(pts); bmh.faces.new((top[i], bot[i], bot[j], top[j]))
    bmh.normal_update()
    trowel = mesh_from(bmh, "trowel", [wood, steel], lambda pg: 0 if pg.center.x < 0.114 else 1)
    BLADE = Vector((0.255, 0, -0.048))
    def tframe(Bp, h, nz):
        M = frame_from_axes(Vector(), h, nz); M.translation = Bp - M.to_3x3() @ BLADE
        return M
    brick_h = brick_obj("brick_in_hand"); brick_p = brick_obj("brick_placed")
    mblob = blob("mortar_on_trowel", 0.045, 0.35)
    # context props (hide on the web if the scene supplies its own)
    pan_bm = bmesh.new()
    ret = bmesh.ops.create_cone(pan_bm, cap_ends=True, segments=20, radius1=0.17, radius2=0.22, depth=0.09)
    pan_ctx = mesh_from(pan_bm, "CTX_mortar_pan", [gltf_mat("pan_steel", base_col=(0.12, 0.12, 0.12, 1), rough=0.6, metal=0.6)])
    stack = [brick_obj(f"CTX_brick_{i}") for i in range(3)]
    PAN = Vector((-0.40, -0.28, 0.0)); STACK = Vector((0.44, -0.22, 0.0)); TOPZ = 0.437
    PLACE = Vector((0.11, -0.525, TOPZ + 0.0375))
    pan_ctx.location = PAN + Vector((0, 0, 0.045));
    for i, b in enumerate(stack):
        b.location = STACK + Vector((0, 0, 0.0375 + 0.08 * i))
    pmound = blob("CTX_mortar_in_pan", 0.17, 0.25, 14); pmound.location = PAN + Vector((0, 0, 0.085))
    PANTOP = PAN + Vector((0, 0, 0.12)); STACKTOP = STACK + Vector((0, 0, 0.0375 + 0.08 * 3))
    POLE = {"_l": Vector((0.45, 0.1, -0.15)), "_r": Vector((-0.45, 0.1, -0.15))}
    def crouch(P, t, lean=0.0, twist=0.0, bob=0.0):
        pel0 = P.rest["pelvis"].to_translation()
        P.pelvis(Vector((0, 0.10, 0.42 - pel0.z + bob)), pitch=18.0, yaw=twist * 0.3)
        for s, sg in (("_l", 1), ("_r", -1)):
            P.leg(s, P.ankle[s] + Vector((0.035 * sg, 0.0, 0.0)), 14.0 * sg)
        P.spine(pitch=30.0 + lean, yaw=twist, w=(0.4, 0.33, 0.27))
    # calibrate grips
    P.begin(); crouch(P, 0)
    Tcal = tframe(Vector((0.05, -0.56, 0.48)), Vector((0.8, -0.6, -0.05)), Z)
    trowel.matrix_world = Tcal; upd()
    _hb = bmesh.new(); cyl(_hb, Vector((0, 0, 0)), Vector((0.115, 0, 0)), 0.0135, 0.0115, 14)
    hproxy = mesh_from(_hb, "tmp_handle", [wood]); hproxy.matrix_world = Tcal; upd()
    hb = obj_bvh(hproxy); bpy.data.objects.remove(hproxy, do_unlink=True)
    Rt = Tcal.to_3x3()
    pc = Tcal @ Vector((0.05, -(0.0125 + 0.010), 0.0))
    nR = (Rt @ Y).normalized(); aR = (Rt @ X).normalized(); dR = nR.cross(aR)
    place_hand(rig, "_r", pc, dR, nR, head_of(rig, "upperarm_r") + POLE["_r"], along=0.10)
    for f in ("index", "middle", "ring", "pinky"):
        curl_finger(rig, "_r", f, [hb], maxdeg=(85, 100, 80), wrap=True)
    curl_finger(rig, "_r", "thumb", [hb], maxdeg=(40, 55, 55), mindeg=(0, 5, 5), radii=(0.011, 0.0095, 0.0085), wrap=True)
    GT = record_grip(rig, "_r", trowel)
    brick_h.matrix_world = Matrix.Translation(PLACE + Vector((0, 0, 0.05))); upd()
    bb = obj_bvh(brick_h); btop = brick_h.matrix_world.to_translation() + Vector((0, 0, 0.0375))
    place_hand(rig, "_l", btop + Vector((0.0, 0.012, 0.0)), Vector((0.05, -1, -0.25)).normalized(), -Z,
               head_of(rig, "upperarm_l") + POLE["_l"], palm_off=0.014)
    for f in ("index", "middle", "ring", "pinky"):
        curl_finger(rig, "_l", f, [bb], maxdeg=(70, 95, 70))
    Bc = brick_h.matrix_world.to_translation()
    aim_chain(rig, ["thumb_01_l", "thumb_02_l", "thumb_03_l"],
              [Bc + Vector((-0.035, 0.068, 0.030)), Bc + Vector((-0.048, 0.066, 0.004)), Bc + Vector((-0.052, 0.064, -0.02))])
    GB = record_grip(rig, "_l", brick_h)
    parent_bone(trowel, "hand_r"); parent_bone(brick_h, "hand_l")
    mblob.matrix_world = Tcal @ Matrix.Translation(BLADE + Vector((0.0, 0, 0.012))); mblob.parent = trowel
    mblob.matrix_parent_inverse = trowel.matrix_world.inverted()
    brick_p.location = PLACE; brick_p.rotation_euler = (0, 0, 0)
    for o in [brick_p, pan_ctx, pmound] + stack:
        parent_bone(o, "Root")
    props += [trowel, brick_h, brick_p, mblob, pan_ctx, pmound] + stack
    fl = lambda v: Vector(v)
    TRO = [  # (t, blade centre, handle dir, blade normal)
        (0.00, fl((-0.36, -0.30, 0.135)), fl((0.35, -0.9, -0.15)), fl((0, 0.25, 1))),
        (0.12, fl((-0.40, -0.26, 0.13)), fl((0.35, -0.9, -0.10)), fl((0, 0.25, 1))),
        (0.32, fl((-0.30, -0.36, 0.24)), fl((0.4, -0.9, 0.05)), fl((0, 0.1, 1))),
        (0.62, fl((0.00, -0.58, 0.475)), fl((0.9, -0.42, -0.08)), fl((0, 0.0, 1))),
        (1.00, fl((0.24, -0.58, 0.468)), fl((0.95, -0.3, -0.06)), fl((0, 0.2, 1))),
        (1.25, fl((-0.16, -0.45, 0.53)), fl((0.4, -0.9, 0.12)), fl((0, 0, 1))),
        (1.62, fl((-0.16, -0.45, 0.53)), fl((0.4, -0.9, 0.12)), fl((0, 0, 1))),
        (2.30, fl((-0.04, -0.405, 0.432)), fl((1.0, -0.15, 0.0)), fl((0, 0, 1))),
        (2.62, fl((0.24, -0.405, 0.432)), fl((1.0, -0.15, 0.0)), fl((0, 0, 1))),
        (2.80, fl((-0.10, -0.38, 0.30)), fl((0.4, -0.9, -0.05)), fl((0, 0.2, 1))),
        (3.00, fl((-0.36, -0.30, 0.135)), fl((0.35, -0.9, -0.15)), fl((0, 0.25, 1))),
    ]
    TROq = [(t, mq(tframe(b, h, nz))) for t, b, h, nz in TRO]
    # trowel butt taps on the placed brick (handle down, blade up)
    TAP_O = PLACE + Vector((0.0, 0.0, 0.0375 + 0.004))
    def tapM(lift):
        return frame_from_axes(TAP_O + Vector((0, 0.0, lift)), Vector((0, 0.18, 1)), Vector((0, -1, 0.18)))
    TAP = [(1.66, mq(tapM(0.06))), (1.82, mq(tapM(0.0))), (1.92, mq(tapM(0.035))), (2.02, mq(tapM(0.0))), (2.14, mq(tapM(0.06)))]
    TROq = [k for k in TROq if k[0] <= 1.62] + TAP + [k for k in TROq if k[0] >= 2.30]
    def bM(p, yaw=0.0):
        M = Matrix.Rotation(math.radians(yaw), 4, 'Z'); M.translation = p; return M
    BRK = [(0.00, mq(bM(STACKTOP + Vector((0, 0, 0.0375 + 0.002))))), (0.25, mq(bM(STACKTOP + Vector((0, 0, 0.09))))),
           (0.70, mq(bM(Vector((0.30, -0.40, 0.56)), 6))), (1.15, mq(bM(PLACE + Vector((0, 0, 0.055)), 3))),
           (1.42, mq(bM(PLACE + Vector((0, 0, 0.008)), 1.5))), (1.52, mq(bM(PLACE + Vector((0, 0, 0.003)), -1.0))),
           (1.60, mq(bM(PLACE, 0.0))),
           (1.95, mq(bM(PLACE + Vector((0.03, 0.06, 0.12))))), (2.45, mq(bM(Vector((0.36, -0.20, 0.42))))),
           (2.80, mq(bM(STACKTOP + Vector((0, 0, 0.06))))), (3.00, mq(bM(STACKTOP + Vector((0, 0, 0.0375 + 0.002)))))]
    def mason_pose(P, t):
        twist = track([(0, -14), (0.35, -8), (0.62, 0), (1.0, 4), (1.3, 6), (1.62, 2), (2.3, 0), (2.62, 3), (2.8, -6), (3.0, -14)], t)
        lean = track([(0, 6), (0.32, 2), (0.62, 0), (1.62, 2), (2.3, 4), (3.0, 6)], t)
        crouch(P, t, lean=lean, twist=twist, bob=-0.01 * math.sin(2 * math.pi * t / 1.5))
        Tm = from_mq(track(TROq, t))
        P.hand("_r", Tm @ GT["M"].inverted(), head_of(rig, "upperarm_r") + POLE["_r"])
        Bm = from_mq(track(BRK, t))
        P.hand("_l", Bm @ GB["M"].inverted(), head_of(rig, "upperarm_l") + POLE["_l"])
        P.fingers({**GT["fingers"], **GB["fingers"]})
        bl = bw(rig, "hand_r") @ GT["M"] @ BLADE
        lt = track([(0, PANTOP), (0.4, PLACE), (1.0, PLACE + X * 0.12), (1.6, PLACE), (2.3, PLACE - Y * 0.06), (2.62, PLACE + X * 0.12 - Y * 0.06), (2.85, PANTOP), (3.0, PANTOP)], t)
        P.look(lt, bl if (0.3 < t < 1.1 or 2.25 < t < 2.7) else lt, neck_w=0.45)
    kb = bm.data.shape_keys.key_blocks
    bm.data.shape_keys.animation_data_create(); bm.data.shape_keys.animation_data.action = None
    def conc(f, t):
        kb["concentrate"].value = 0.35 + 0.15 * math.sin(2 * math.pi * t / 3.0)
        kb["concentrate"].keyframe_insert("value", frame=f)
    n = bake_clip(P, "lay_brick", 3.0, mason_pose, extra_key=conc, loop=True)
    push_nla(rig, "lay_brick"); push_nla(bm.data.shape_keys, "lay_brick"); kb["concentrate"].value = 0
    REL = int(round(1.60 * FPS)); PICK = int(round(2.95 * FPS))
    key_scale(brick_h, [(0, 1), (REL, 0), (PICK, 1), (n, 1)], "lay_brick")
    key_scale(brick_p, [(0, 0), (REL, 1), (n - 1, 1), (n, 0)], "lay_brick")
    key_scale(mblob, [(0, 0), (int(0.12 * FPS), 1), (int(0.8 * FPS), 0.6), (int(1.0 * FPS), 0), (n, 0)], "lay_brick")
    CLIPS.append(("lay_brick", n))

elif ROLE == "worker_plaster":
    # ---------------- steel float + hawk + plaster
    bmh = bmesh.new()
    for v in [(-0.14, -0.06), (0.14, -0.06), (0.14, 0.06), (-0.14, 0.06)]: pass
    ret = bmesh.ops.create_cube(bmh, size=1.0)
    for v in ret["verts"]: v.co = Vector((v.co.x * 0.28, v.co.y * 0.12, v.co.z * 0.002))
    cyl(bmh, Vector((-0.075, 0, 0.056)), Vector((0.075, 0, 0.056)), 0.014, 0.014, 14)
    for x in (-0.07, 0.07):
        cyl(bmh, Vector((x, 0, 0.001)), Vector((x, 0, 0.045)), 0.004, 0.004, 8)
    flt = mesh_from(bmh, "plaster_trowel", [steel, wood], lambda pg: 1 if (pg.center.z > 0.03 and abs(pg.center.x) < 0.076) else 0)
    bmh = bmesh.new()
    ret = bmesh.ops.create_cube(bmh, size=1.0)
    for v in ret["verts"]: v.co = Vector((v.co.x * 0.30, v.co.y * 0.30, v.co.z * 0.008 - 0.004))
    cyl(bmh, Vector((0, 0, -0.008)), Vector((0, 0, -0.14)), 0.016, 0.017, 14)
    alu = gltf_mat("aluminium", base_col=(0.55, 0.55, 0.55, 1), rough=0.45, metal=1.0)
    hawk = mesh_from(bmh, "hawk", [alu, wood], lambda pg: 1 if pg.center.z < -0.009 else 0)
    plas_m = gltf_mat("plaster", base_col=srgb("#A8A49A"), rough=0.92)
    mound = blob("plaster_on_hawk", 0.09, 0.35, 12); mound.data.materials[0] = plas_m
    pblob = blob("plaster_on_trowel", 0.07, 0.18, 12); pblob.data.materials[0] = plas_m
    WALL = -0.46
    POLE = {"_l": Vector((0.40, 0.3, -0.35)), "_r": Vector((-0.45, 0.35, -0.3))}
    P.begin(); P.pelvis(Vector((0, 0, -0.016))); plant(P)
    def hawkM(c, tilt=0.0):
        R = Matrix.Rotation(math.radians(tilt), 3, 'X')
        return frame_from_axes(c, R @ -X, R @ Z)
    HAWK = Vector((0.20, -0.30, 1.10))
    hawk.matrix_world = hawkM(HAWK); upd()
    _b = bmesh.new(); cyl(_b, Vector((0, 0, -0.008)), Vector((0, 0, -0.14)), 0.016, 0.017, 14)
    _p = mesh_from(_b, "tmp_hawk_handle", [wood]); _p.matrix_world = hawk.matrix_world; upd()
    hk = obj_bvh(_p); bpy.data.objects.remove(_p, do_unlink=True); Rh = hawk.matrix_world.to_3x3()
    nL = (Rh @ X).normalized(); aL = (Rh @ Z).normalized(); dL = aL.cross(nL)
    pc = hawk.matrix_world @ Vector((-0.028, 0, -0.07))
    place_hand(rig, "_l", pc, dL, nL, head_of(rig, "upperarm_l") + POLE["_l"], along=0.10)
    for f in ("index", "middle", "ring", "pinky"):
        curl_finger(rig, "_l", f, [hk], maxdeg=(85, 100, 80), wrap=True)
    curl_finger(rig, "_l", "thumb", [hk], maxdeg=(40, 55, 55), mindeg=(0, 5, 5), radii=(0.011, 0.0095, 0.0085), wrap=True)
    GH = record_grip(rig, "_l", hawk)
    def floatM(c, xa, za):
        return frame_from_axes(c, xa, za)
    Fcal = floatM(Vector((-0.05, -0.38, 1.20)), Vector((0.97, 0, 0.26)), Vector((0, 0.6, 0.8)))
    flt.matrix_world = Fcal; upd()
    _b = bmesh.new(); cyl(_b, Vector((-0.075, 0, 0.056)), Vector((0.075, 0, 0.056)), 0.014, 0.014, 14)
    _p = mesh_from(_b, "tmp_float_handle", [wood]); _p.matrix_world = Fcal; upd()
    fb = obj_bvh(_p); bpy.data.objects.remove(_p, do_unlink=True); Rf = Fcal.to_3x3()
    nR = (Rf @ -Z).normalized(); aR = (Rf @ X).normalized(); dR = nR.cross(aR)
    place_hand(rig, "_r", Fcal @ Vector((0, 0, 0.056 + 0.014 + 0.008)), dR, nR, head_of(rig, "upperarm_r") + POLE["_r"], along=0.10)
    for f in ("index", "middle", "ring", "pinky"):
        curl_finger(rig, "_r", f, [fb], maxdeg=(85, 100, 80), wrap=True)
    curl_finger(rig, "_r", "thumb", [fb], maxdeg=(40, 55, 55), mindeg=(0, 5, 5), radii=(0.011, 0.0095, 0.0085), wrap=True)
    GF = record_grip(rig, "_r", flt)
    parent_bone(hawk, "hand_l"); parent_bone(flt, "hand_r")
    mound.matrix_world = hawk.matrix_world @ Matrix.Translation((0.0, 0.02, 0.012)); upd()
    mw = mound.matrix_world.copy(); mound.parent = hawk; mound.matrix_world = mw
    pblob.matrix_world = flt.matrix_world @ Matrix.Translation((0.0, 0.0, -0.006)); upd()
    mw = pblob.matrix_world.copy(); pblob.parent = flt; pblob.matrix_world = mw
    props += [hawk, flt, mound, pblob]
    up = lambda tilt: Vector((0, math.cos(math.radians(tilt)), -math.sin(math.radians(tilt))))
    HT = HAWK + Vector((0, 0, 0.012))
    FLT = [
        (0.00, mq(floatM(HT + Vector((-0.02, -0.06, 0.004)), Vector((0, -1, 0.05)), Z))),
        (0.30, mq(floatM(HT + Vector((-0.02, 0.06, 0.006)), Vector((0, -1, 0.05)), Z))),
        (0.55, mq(floatM(Vector((-0.02, -0.36, 1.20)), Vector((0.95, 0, 0.3)), Vector((0, 0.5, 0.86))))),
        (0.80, mq(floatM(Vector((-0.10, WALL + 0.035, 1.00)), Vector((0.97, 0, 0.26)), up(25)))),
        (0.92, mq(floatM(Vector((-0.10, WALL + 0.011, 1.00)), Vector((0.97, 0, 0.26)), up(9)))),
        (1.40, mq(floatM(Vector((0.03, WALL + 0.011, 1.26)), Vector((0.99, 0, 0.0)), up(9)))),
        (1.85, mq(floatM(Vector((0.12, WALL + 0.011, 1.48)), Vector((0.93, 0, -0.35)), up(9)))),
        (2.05, mq(floatM(Vector((0.13, WALL + 0.05, 1.50)), Vector((0.93, 0, -0.35)), up(25)))),
        (2.55, mq(floatM(Vector((0.02, -0.36, 1.22)), Vector((0.5, -0.8, 0.1)), Vector((0, 0.3, 0.95))))),
        (3.00, mq(floatM(HT + Vector((-0.02, -0.06, 0.004)), Vector((0, -1, 0.05)), Z))),
    ]
    def plaster_pose(P, t):
        sw = ease((t - 0.85) / 1.0) * (1 - ease((t - 1.9) / 0.6))
        P.pelvis(Vector((0.01 * sw, -0.025 * sw, -0.018)), pitch=2.0 * sw, yaw=-6.0 * sw)
        plant(P, yaw=(6.0, -8.0))
        P.spine(pitch=4.0 - 7.0 * ease((t - 1.0) / 0.85) * (1 - ease((t - 1.9) / 0.6)) + 3.0 * (1 - sw),
                yaw=track([(0, 8), (0.5, 4), (0.9, -6), (1.85, 4), (2.5, 6), (3.0, 8)], t))
        Hm = hawkM(HAWK + Vector((-0.03 * ease(t / 0.2) * (1 - ease((t - 0.3) / 0.3)), 0, 0)), 4.0)
        P.hand("_l", Hm @ GH["M"].inverted(), head_of(rig, "upperarm_l") + POLE["_l"])
        Fm = from_mq(track(FLT, t))
        P.hand("_r", Fm @ GF["M"].inverted(), head_of(rig, "upperarm_r") + POLE["_r"])
        P.fingers({**GH["fingers"], **GF["fingers"]})
        fc = (bw(rig, "hand_r") @ GF["M"]).to_translation()
        lt = track([(0, HT), (0.45, HT), (0.8, fc), (2.0, fc), (2.5, HT), (3.0, HT)], t) if not (0.7 < t < 2.05) else fc + Vector((0, 0.02, 0.05))
        P.look(lt, fc if 0.6 < t < 2.1 else HT, neck_w=0.45)
    kb = bm.data.shape_keys.key_blocks
    bm.data.shape_keys.animation_data_create(); bm.data.shape_keys.animation_data.action = None
    def conc(f, t):
        kb["concentrate"].value = 0.3 + 0.2 * ease((t - 0.8) / 0.3) * (1 - ease((t - 1.9) / 0.4))
        kb["concentrate"].keyframe_insert("value", frame=f)
    n = bake_clip(P, "apply_plaster", 3.0, plaster_pose, extra_key=conc, loop=True)
    push_nla(rig, "apply_plaster"); push_nla(bm.data.shape_keys, "apply_plaster"); kb["concentrate"].value = 0
    key_scale(pblob, [(0, 0), (int(0.28 * FPS), 1), (int(1.2 * FPS), 0.7), (int(1.8 * FPS), 0.35), (int(1.95 * FPS), 0), (n, 0)], "apply_plaster")
    CLIPS.append(("apply_plaster", n))

log("clips", CLIPS)

# =================================================================== budget: decimate body if needed (morphs kept)
def total_tris():
    return sum(tri_count(o) for o in coll.objects if o.type == 'MESH')
tt = total_tris(); bt = tri_count(bm)
log("tris before decimate", tt, "body", bt)
if tt > CFG["budget"] * 0.94:
    target_body = bt - (tt - CFG["budget"] * 0.93)
    ratio = max(0.3, target_body / bt)
    decimate_keep_keys(bm, ratio)
    log("decimated body ratio", round(ratio, 3), "-> body", tri_count(bm), "total", total_tris())
    for g in ("head", "hand_l", "middle_02_l", "lowerarm_l"):
        vg = bm.vertex_groups.get(g)
        log("   region", g, sum(1 for v in bm.data.vertices for x in v.groups if x.group == vg.index and x.weight > 0.3))
add_hair_shells(bm, ha, 3)
log("with hair shells total tris", total_tris())

# =================================================================== export
rig.data.pose_position = 'POSE'
rig.animation_data.action = None
P.begin()
for o in coll.objects:
    if o.type == 'MESH':
        for m in o.modifiers:
            if m.type != 'ARMATURE': print("WARN modifier left", o.name, m.name)
glb = os.path.join(OUT, ROLE + ".glb")
for o in bpy.context.scene.objects: o.select_set(o.name in coll.objects)
bpy.context.view_layer.objects.active = rig
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
                          export_skins=True, export_morph=True, export_morph_normal=True, export_morph_tangent=False,
                          export_animations=True, export_animation_mode='NLA_TRACKS', export_merge_animation='NLA_TRACK',
                          export_force_sampling=True, export_optimize_animation_size=True, export_def_bones=False,
                          export_leaf_bone=False, export_image_format='WEBP', export_image_quality=82,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                          export_draco_position_quantization=14, export_draco_normal_quantization=10,
                          export_draco_texcoord_quantization=12, export_tangents=False, export_extras=True,
                          export_frame_range=False, export_anim_slide_to_zero=True)
log("exported", glb, round(os.path.getsize(glb) / 1e6, 2), "MB")
summary = dict(role=ROLE, tris=total_tris(), bones=len(rig.data.bones), clips=[(c, n / FPS) for c, n in CLIPS],
               morphs=[k.name for k in bm.data.shape_keys.key_blocks[1:]], size_mb=round(os.path.getsize(glb) / 1e6, 2))
json.dump(summary, open(os.path.join(WORK, ROLE + "_summary.json"), "w"), indent=1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, ROLE + ".blend"), compress=True)
log("SUMMARY", summary)
