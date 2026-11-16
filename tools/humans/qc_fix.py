"""Builder trouser fix QC: back + 3/4 front stills, and a body-through-trousers check over all clip frames."""
import bpy, sys, os, json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
sys.argv = [sys.argv[0], "--", "builder", "idle_inspect", "1.0"]
exec(open(os.path.join(HERE, "qc_glb.py"), encoding="utf-8").read().split("# QC rig")[0])
dg = bpy.context.evaluated_depsgraph_get()
body = next(o for o in bpy.data.objects if o.type == "MESH" and o.data.shape_keys); outfit = bpy.data.objects["outfit"]
print("QCTYPES", body.type, outfit.type)
worst = {}
for clip, (f0, f1) in rep["actions"]:
    use_clip(clip); w = 0
    for f in range(f0, f1 + 1, 4):
        sc.frame_set(f); dg = bpy.context.evaluated_depsgraph_get()
        oe = outfit.evaluated_get(dg); be = body.evaluated_get(dg)
        om = oe.data
        tree = BVHTree.FromPolygons([outfit.matrix_world @ v.co for v in om.vertices], [p.vertices[:] for p in om.polygons])
        bme = be.data
        for v in bme.vertices:
            p = body.matrix_world @ v.co
            if p.z > 0.85 or p.z < 0.2 or p.y < -0.15: continue      # trouser zone only
            loc, n, i, d = tree.find_nearest(p)
            if loc is not None and d < 0.02 and (p - loc).dot(n) > 0.001: w += 1; worst.setdefault(clip + "_pts", []).append(tuple(round(c, 2) for c in p)) if w < 4 else None
    worst[clip] = w
print("QCPOKE", json.dumps(worst))
use_clip("idle_inspect"); sc.frame_set(24)
exec(open(os.path.join(HERE, "qc_glb.py"), encoding="utf-8").read().split("# QC rig")[1].split("at = Vector")[0])
at = Vector((ctr.x, ctr.y, mn.z + hgt * 0.5)); dist = hgt * 2.4
for name, d in (("builder_fix_back", Vector((-0.35, 1.0, 0.1))), ("builder_fix_front", Vector((0.7, -1.0, 0.12)))):
    c = cam(name, at + d.normalized() * dist, at, 50); sc.camera = c
    sc.render.filepath = os.path.join(ROOT, "docs", "humans_qc", name + ".png"); bpy.ops.render.render(write_still=True)
