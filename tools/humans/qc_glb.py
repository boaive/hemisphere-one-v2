"""Re-import a human GLB with Blender's glTF importer, report clips/morphs/tris, render a 1280x720 EEVEE QC still.
blender -b --python qc_glb.py -- <role> [clip] [seconds] [extra_dir]"""
import bpy, sys, os, math, json
from mathutils import Vector
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
argv = sys.argv[sys.argv.index("--") + 1:]
ROLE = argv[0]; CLIP = argv[1] if len(argv) > 1 else None; SEC = float(argv[2]) if len(argv) > 2 else 1.0
EXTRA = argv[3] if len(argv) > 3 else None
glb = os.path.join(ROOT, "public", "models", "humans", ROLE + ".glb")
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=glb)
sc = bpy.context.scene
rep = {"role": ROLE, "file_mb": round(os.path.getsize(glb) / 1e6, 2)}
rep["actions"] = sorted({a.name: [round(a.frame_range[0]), round(a.frame_range[1])] for a in bpy.data.actions}.items())
rep["morphs"] = sorted({k.name for o in bpy.data.objects if o.type == 'MESH' and o.data.shape_keys for k in o.data.shape_keys.key_blocks[1:]})
rep["tris"] = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
rep["bones"] = len(arm.data.bones)
rep["objects"] = sorted(o.name for o in bpy.data.objects)
rep["height_rest"] = round(max((o.matrix_world @ Vector(c)).z for o in bpy.data.objects if o.type == 'MESH' for c in o.bound_box), 3)
# tracks the importer created
tracks = {}
for o in bpy.data.objects:
    for idb in (o, o.data.shape_keys if o.type == 'MESH' and o.data.shape_keys else None):
        if idb and idb.animation_data:
            tracks[idb.name] = [t.name for t in idb.animation_data.nla_tracks] + ([("ACTIVE:" + idb.animation_data.action.name)] if idb.animation_data.action else [])
rep["tracks"] = tracks
print("QCREPORT", json.dumps(rep))

def use_clip(clip):
    """Solo the NLA tracks (or actions) belonging to one glTF animation on every animated datablock."""
    for o in bpy.data.objects:
        for idb in (o, o.data.shape_keys if o.type == 'MESH' and o.data.shape_keys else None):
            if not idb or not idb.animation_data: continue
            ad = idb.animation_data
            hit = None
            for t in ad.nla_tracks:
                t.mute = True
                for st in t.strips:
                    if st.action and st.action.name.startswith(clip): hit = t
            if hit:
                hit.mute = False; ad.action = None
            else:
                acts = [a for a in bpy.data.actions if a.name.startswith(clip)]
                if ad.action and not ad.action.name.startswith(clip):
                    ad.action = None
# foot-plant check: max world drift of each ankle per clip (frames sampled every 2)
arm_ = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
drift = {}
for clip, (f0, f1) in rep["actions"]:
    use_clip(clip)
    pos = {"foot_l": [], "foot_r": []}
    for f in range(f0, f1 + 1, 2):
        sc.frame_set(f)
        for b in pos:
            pos[b].append(arm_.matrix_world @ arm_.pose.bones[b].head)
    drift[clip] = {b: round(max((p - v[0]).length for p in v) * 100, 2) for b, v in pos.items()}
print("QCDRIFT_CM", json.dumps(drift))
if CLIP:
    use_clip(CLIP)
sc.render.fps = 24
sc.frame_set(int(round(SEC * 24)))
# QC rig
try: sc.render.engine = 'BLENDER_EEVEE'
except TypeError: sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
sc.view_settings.view_transform = 'AgX'
ee = sc.eevee
for k, v in (("taa_render_samples", 64), ("use_raytracing", True), ("use_shadows", True)):
    if hasattr(ee, k): setattr(ee, k, v)
w = bpy.data.worlds.new("grey"); w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.18, 0.18, 0.18, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.5
sc.world = w
dg = bpy.context.evaluated_depsgraph_get()
pts = []
for o in bpy.data.objects:
    if o.name.startswith("Icosphere"):
        o.hide_render = True; continue
    if o.type == 'MESH' and not o.name.startswith("CTX"):
        oe = o.evaluated_get(dg); m = oe.to_mesh()
        pts += [o.matrix_world @ m.vertices[i].co for i in range(0, len(m.vertices), 7)]
        oe.to_mesh_clear()
mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
ctr = (mn + mx) / 2; hgt = mx.z - mn.z
print("QCBOUNDS", tuple(round(c, 3) for c in mn), tuple(round(c, 3) for c in mx))
def cam(name, loc, at, lens):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.sensor_width = 36
    c = bpy.data.objects.new(name, cd); sc.collection.objects.link(c)
    c.location = loc; c.rotation_euler = (at - loc).to_track_quat('-Z', 'Y').to_euler()
    cd.dof.use_dof = True; cd.dof.aperture_fstop = 8.0; cd.dof.focus_distance = (at - loc).length
    return c
def light(name, loc, at, power, size, col=(1, 1, 1)):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = power; ld.size = size; ld.color = col
    l = bpy.data.objects.new(name, ld); sc.collection.objects.link(l)
    l.location = loc; l.rotation_euler = (at - loc).to_track_quat('-Z', 'Y').to_euler()
light("key", ctr + Vector((1.6, -2.0, 1.4)), ctr, 220, 1.2, (1.0, 0.94, 0.86))
light("fill", ctr + Vector((-2.0, -1.6, 0.4)), ctr, 70, 2.0, (0.9, 0.95, 1.0))
light("rim", ctr + Vector((-0.8, 2.0, 1.6)), ctr, 300, 0.8)
at = Vector((ctr.x, ctr.y, mn.z + hgt * 0.55))
dist = max(hgt, (mx.x - mn.x) * 0.6) * 2.6
c = cam("qc", at + Vector((0.55, -1.0, 0.12)).normalized() * dist, at, 50)
sc.camera = c
out = os.path.join(ROOT, "docs", "humans_qc", f"qc_{ROLE}.png")
sc.render.filepath = out; bpy.ops.render.render(write_still=True)
print("QCSAVED", out)
if EXTRA:
    head = Vector((ctr.x, ctr.y, mx.z - 0.14))
    for nm, loc, tgt, lens in (("face", head + Vector((0.25, -0.75, -0.02)), head + Vector((0, 0, -0.02)), 85),
                               ("hands", ctr + Vector((0.35, -1.3, 0.25)), Vector((ctr.x, ctr.y, mn.z + hgt * 0.62)), 50),
                               ("side", ctr + Vector((2.6, 0.0, 0.2)), at, 50)):
        c2 = cam(nm, loc, tgt, lens); sc.camera = c2
        sc.render.filepath = os.path.join(EXTRA, f"{ROLE}_{nm}.png"); bpy.ops.render.render(write_still=True)
