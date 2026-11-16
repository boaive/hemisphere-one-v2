"""HEMISPHERE ONE - procedural hand-keyed animation: every frame is solved from controls (feet, pelvis,
spine, gaze, tool paths) with analytic IK, then keyed. Feet are pinned in world space -> no sliding.
Tools are bone-parented, hands are solved from the tool pose -> tools never leave the grip."""
import bpy, math
from mathutils import Vector, Matrix, Quaternion
from ho_common import upd
from ho_parts import (bw, set_bw, rot_bone, head_of, tail_of, ydir, aim, two_bone, hand_frame, place_hand,
                      distribute_twist, curl_finger, aim_chain, reset_pose, obj_bvh)

FPS = 24
FINGERS = ("thumb", "index", "middle", "ring", "pinky")

def ease(x):
    x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)

def track(keys, t):
    """keys: [(time, value)], value = float | Vector | (Vector, Quaternion). Eased piecewise interpolation."""
    if t <= keys[0][0]: return keys[0][1]
    if t >= keys[-1][0]: return keys[-1][1]
    for (t0, a), (t1, b) in zip(keys, keys[1:]):
        if t0 <= t <= t1:
            f = ease((t - t0) / (t1 - t0)) if t1 > t0 else 1.0
            if isinstance(a, tuple):
                return (a[0].lerp(b[0], f), a[1].slerp(b[1], f))
            if isinstance(a, Vector): return a.lerp(b, f)
            return a + (b - a) * f
    return keys[-1][1]

def frame_from_axes(origin, x_axis, z_axis):
    x = x_axis.normalized(); z = (z_axis - x * z_axis.dot(x)).normalized(); y = z.cross(x)
    M = Matrix((x, y, z)).transposed().to_4x4(); M.translation = origin
    return M

def mq(M):
    return (M.to_translation(), M.to_quaternion())

def from_mq(v):
    p, q = v
    M = q.to_matrix().to_4x4(); M.translation = p
    return M

class Poser:
    def __init__(self, rig, sole=0.0):
        self.rig = rig; self.sole = sole
        reset_pose(rig)
        self._lift()
        self.rest = {b.name: bw(rig, b.name).copy() for b in rig.pose.bones}
        hr = self.rest["head"].to_3x3()
        self.head_fwd = hr.inverted() @ Vector((0, -1, 0))
        self.ankle = {s: self.rest["foot" + s].to_translation() for s in ("_l", "_r")}
        self.prevq = {}

    def _lift(self):
        if self.sole:
            set_bw(self.rig, "Root", Matrix.Translation((0, 0, self.sole)) @ bw(self.rig, "Root"))

    def begin(self):
        reset_pose(self.rig); self._lift()

    def pelvis(self, offset=Vector(), pitch=0.0, roll=0.0, yaw=0.0):
        M = bw(self.rig, "pelvis"); h = M.to_translation()
        R = (Matrix.Rotation(math.radians(yaw), 4, 'Z') @ Matrix.Rotation(math.radians(pitch), 4, 'X') @
             Matrix.Rotation(math.radians(roll), 4, 'Y'))
        set_bw(self.rig, "pelvis", Matrix.Translation(offset) @ Matrix.Translation(h) @ R @ Matrix.Translation(-h) @ M)

    def spine(self, pitch=0.0, yaw=0.0, roll=0.0, w=(0.3, 0.35, 0.35)):
        for bn, k in zip(("spine_01", "spine_02", "spine_03"), w):
            R = (Matrix.Rotation(math.radians(yaw * k), 3, 'Z') @ Matrix.Rotation(math.radians(pitch * k), 3, 'X') @
                 Matrix.Rotation(math.radians(roll * k), 3, 'Y'))
            rot_bone(self.rig, bn, R)

    def shoulders(self, drop=0.0):
        for s, sg in (("_l", 1), ("_r", -1)):
            rot_bone(self.rig, "clavicle" + s, Matrix.Rotation(math.radians(drop * sg), 3, 'Y'))

    def leg(self, side, ankle, yaw=0.0, toe_pitch=0.0):
        sg = 1 if side == "_l" else -1
        pole = head_of(self.rig, "thigh" + side) + Vector((0.12 * sg, -0.6, -0.05))
        two_bone(self.rig, "thigh" + side, "calf" + side, ankle, pole)
        R = Matrix.Rotation(math.radians(yaw), 3, 'Z') @ self.rest["foot" + side].to_3x3()
        if toe_pitch:
            R = Matrix.Rotation(math.radians(toe_pitch), 3, 'X') @ R
        set_bw(self.rig, "foot" + side, Matrix.Translation(head_of(self.rig, "foot" + side)) @ R.to_4x4())

    def look(self, target, eye_target=None, neck_w=0.4, max_deg=70.0, eye_w=1.0):
        rig = self.rig
        for bn, w in (("neck_01", neck_w), ("head", 1.0)):
            hp = head_of(rig, "head")
            fwd = bw(rig, "head").to_3x3() @ self.head_fwd
            d = (target - hp).normalized()
            q = fwd.rotation_difference(d)
            ang = min(q.angle, math.radians(max_deg)) * w
            if ang > 1e-5:
                rot_bone(rig, bn, Matrix.Rotation(ang, 3, q.axis))
        et = eye_target if eye_target is not None else target
        for s in ("l", "r"):
            bn = "eye_" + s
            if bn in rig.pose.bones:
                hp = head_of(rig, bn); cur = ydir(rig, bn); d = (et - hp).normalized()
                q = cur.rotation_difference(d)
                ang = min(q.angle, math.radians(17)) * eye_w
                if ang > 1e-5:
                    rot_bone(rig, bn, Matrix.Rotation(ang, 3, q.axis))

    def hand(self, side, Mh, pole, iters=2):
        rig = self.rig
        R = Mh.to_3x3().normalized()
        for _ in range(iters):
            two_bone(rig, "upperarm" + side, "lowerarm" + side, Mh.to_translation(), pole)
            set_bw(rig, "hand" + side, Matrix.Translation(head_of(rig, "hand" + side)) @ R.to_4x4())
            distribute_twist(rig, side, 0.55)
            set_bw(rig, "hand" + side, Matrix.Translation(head_of(rig, "hand" + side)) @ R.to_4x4())

    def fingers(self, quats):
        for bn, q in quats.items():
            self.rig.pose.bones[bn].rotation_quaternion = q
        upd()

    def key(self, frame, loc_bones=("Root", "pelvis")):
        for pb in self.rig.pose.bones:
            q = pb.rotation_quaternion.copy()
            pq = self.prevq.get(pb.name)
            if pq is not None and pq.dot(q) < 0:
                q.negate(); pb.rotation_quaternion = q
            self.prevq[pb.name] = q
            pb.keyframe_insert("rotation_quaternion", frame=frame, group=pb.name)
        for bn in loc_bones:
            self.rig.pose.bones[bn].keyframe_insert("location", frame=frame, group=bn)

def finger_quats(rig, side):
    out = {}
    for f in FINGERS:
        for i in (1, 2, 3):
            bn = f"{f}_0{i}{side}"
            out[bn] = rig.pose.bones[bn].rotation_quaternion.copy()
    return out

def record_grip(rig, side, tool):
    return dict(M=bw(rig, "hand" + side).inverted() @ tool.matrix_world, fingers=finger_quats(rig, side))

def record_second(rig, side, tool):
    return dict(M=tool.matrix_world.inverted() @ bw(rig, "hand" + side), fingers=finger_quats(rig, side))

def push_nla(owner, clip):
    ad = owner.animation_data
    act = ad.action
    if act is None: return None
    act.name = clip
    ad.action = None
    tr = ad.nla_tracks.new(); tr.name = clip
    st = tr.strips.new(clip, int(act.frame_range[0]), act)
    try:
        if act.slots and st.action_slot is None:
            st.action_slot = act.slots[0]
    except Exception:
        pass
    act.use_fake_user = True
    return tr

def bake_clip(P, clip, seconds, pose_fn, extra_key=None, loop=True):
    """pose_fn(P, t) poses the rig; extra_key(frame, t) keys shape keys / object props."""
    rig = P.rig
    rig.animation_data_create()
    rig.animation_data.action = None
    P.prevq = {}
    n = int(round(seconds * FPS))
    for f in range(0, n + 1):
        t = f / FPS
        if loop and f == n: t = 0.0
        P.begin()
        pose_fn(P, t)
        P.key(f)
        if extra_key: extra_key(f, t)
    return n
