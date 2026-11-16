import bpy, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ho_web import *
from collections import Counter
clean_scene()
bm, rig = make_human(dict(gender=1.0, age=0.57, muscle=0.72, weight=0.45, height=0.40, proportions=0.55,
                          race={"asian": 0.2, "caucasian": 0.42, "african": 0.38}), {})
R, belt_z, clav_z, ankle_z = classify_web(bm, rig, dict(tuck=0.0, sleeve="none", strap_x=0.075, boot_h=0.24, hem=0.19))
dom = dominant_bones(bm, rig)
body = vg_set(bm, "body")
me = bm.data
print("PRB clav_z", round(clav_z, 3), "armpit", round(rig.data.bones["upperarm_l"].head_local.z - 0.095, 3))
strap = [i for i in body if 0.075 < abs(me.vertices[i].co.x) < 0.115 and me.vertices[i].co.z > clav_z - 0.06 and abs(me.vertices[i].co.y) < 0.12]
print("PRB strap candidates", len(strap), "in shirt", sum(1 for i in strap if i in R["shirt"]))
print("PRB dom", Counter(dom[i] for i in strap).most_common(6))
print("PRB z range", round(min(me.vertices[i].co.z for i in strap), 3), round(max(me.vertices[i].co.z for i in strap), 3))
band = [i for i in body if 0.07 < abs(me.vertices[i].co.x) < 0.12 and 1.36 < me.vertices[i].co.z < 1.48 and me.vertices[i].co.y < -0.0]
print("PRB band", len(band), "in shirt", sum(1 for i in band if i in R["shirt"]), Counter(dom[i] for i in band).most_common(5))
print("PRB band y", sorted(round(me.vertices[i].co.y,3) for i in band)[:5], "...")
ex = [i for i in band if i not in R["shirt"]]
for i in ex[:6]:
    v = me.vertices[i].co; print("PRB miss", tuple(round(c,3) for c in v), dom[i])
