import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { film, stepClock } from './clock';
import { sampleTrack } from './track';
import { shotAt, storyTime, type Shot } from './shots';
import { projectAnchors } from '../world/anchors';

/**
 * One virtual cinema camera (full-frame 36 mm gauge). Each shot supplies position, look-at and focal length tracks.
 * Offline renders add sub-frame samples: pixel jitter (anti-aliasing) and an aperture offset with a sheared frustum
 * that keeps the focus plane fixed (true optical depth of field when the samples are averaged).
 */
export const camState = { shot: null as Shot | null, scale: 'city' as Shot['scale'], focusDist: 10, targetDist: 120 };

export function CameraRig() {
  const { camera, size } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const s = useMemo(() => ({ p: [0, 0, 0], q: [0, 0, 0], f: [35], r: [0], fwd: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), Y: new THREE.Vector3(0, 1, 0), aim: new THREE.Vector3(), v: new THREE.Vector3(),
    a0: new THREE.Vector3(), a1: new THREE.Vector3(), dir: new THREE.Vector3(), qa: new THREE.Quaternion(), qb: new THREE.Quaternion(), t0: [0, 0, 0], t1: [0, 0, 0] }), []);

  useFrame((_, dt) => {
    stepClock(dt);
    film.story = storyTime(film.scene, film.t);
    const { shot, local } = shotAt(film.scene, film.t);
    camState.shot = shot; camState.scale = shot.scale;
    sampleTrack(shot.pos, local, s.p);
    sampleTrack(shot.tgt, local, s.q);
    sampleTrack(shot.lens, local, s.f);
    // angular aim: rotate the view direction evenly between the shot's first and last aim (tilts and pans
    // between far and near subjects keep a smooth angular speed instead of whipping at the end)
    if (shot.aim === 'slerp') {
      const u = shot.dur > 0 ? Math.min(1, Math.max(0, local / shot.dur)) : 0;
      const e = u * u * u * (u * (u * 6 - 15) + 10);
      const a0 = s.a0, a1 = s.a1;
      sampleTrack(shot.pos, 0, s.t0); sampleTrack(shot.tgt, 0, s.t1);
      a0.set(s.t1[0] - s.t0[0], s.t1[1] - s.t0[1], s.t1[2] - s.t0[2]); const d0 = a0.length(); a0.normalize();
      sampleTrack(shot.pos, shot.dur, s.t0); sampleTrack(shot.tgt, shot.dur, s.t1);
      a1.set(s.t1[0] - s.t0[0], s.t1[1] - s.t0[1], s.t1[2] - s.t0[2]); const d1 = a1.length(); a1.normalize();
      s.qa.setFromUnitVectors(a0, a1);
      s.qb.identity().slerp(s.qa, e);
      s.dir.copy(a0).applyQuaternion(s.qb);
      const d = d0 + (d1 - d0) * e;
      s.q[0] = s.p[0] + s.dir.x * d; s.q[1] = s.p[1] + s.dir.y * d; s.q[2] = s.p[2] + s.dir.z * d;
    }
    if (shot.roll) sampleTrack(shot.roll, local, s.r); else s.r[0] = 0;
    let f = s.f[0];

    // phone cut: independent framing, not a crop
    if (film.portrait && shot.portrait) {
      const P = shot.portrait;
      if (P.tgt) { s.q[0] += P.tgt[0]; s.q[1] += P.tgt[1]; s.q[2] += P.tgt[2]; }
      const k = P.pull ?? 1;
      for (let i = 0; i < 3; i++) s.p[i] = s.q[i] + (s.p[i] - s.q[i]) * k;
      s.p[1] += P.lift ?? 0;
      s.p[1] = Math.max(s.p[1], 0.6);
      f *= P.lens ?? 1;
    }

    cam.position.set(s.p[0], s.p[1], s.p[2]);
    cam.up.copy(s.Y);
    // architectural lens shift: level the camera by `level` of its pitch and shift the frustum so the subject
    // still sits at frame centre - verticals stay parallel instead of converging
    const level = shot.level ?? (shot.scale === 'human' ? 0.5 : 0.85);
    const hx = s.q[0] - s.p[0], hz = s.q[2] - s.p[2];
    s.aim.set(s.q[0], s.p[1] + (s.q[1] - s.p[1]) * (1 - level), s.q[2]);
    if (Math.hypot(hx, hz) < 1e-3) s.aim.set(s.q[0], s.q[1], s.q[2]);
    cam.lookAt(s.aim);
    if (s.r[0]) cam.rotateZ((s.r[0] * Math.PI) / 180);
    cam.updateMatrixWorld(true);
    cam.filmGauge = 36;
    cam.setFocalLength(f);
    cam.near = shot.scale === 'human' ? 0.05 : shot.scale === 'site' ? 0.15 : 0.8;
    cam.far = shot.scale === 'city' ? 9000 : 6000;
    cam.updateProjectionMatrix();
    s.v.set(s.q[0], s.q[1], s.q[2]).project(cam);
    cam.projectionMatrix.elements[9] += s.v.y;
    const sh = film.portrait && shot.portrait?.shift ? shot.portrait.shift : shot.shift;
    if (sh) { cam.projectionMatrix.elements[8] += sh[0]; cam.projectionMatrix.elements[9] += sh[1]; }
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    const dx = s.q[0] - s.p[0], dy = s.q[1] - s.p[1], dz = s.q[2] - s.p[2];
    const focus = shot.focus === 'target' ? Math.hypot(dx, dy, dz) : shot.focus ?? 1e6;
    camState.focusDist = focus;
    camState.targetDist = Math.hypot(dx, dy, dz);

    // anchors are projected from the un-jittered camera
    projectAnchors(cam, size.width, size.height);

    if (film.render) {
      const P = cam.projectionMatrix.elements;
      // depth of field: move the lens across the aperture, shear the frustum so the focus plane stays put
      if (shot.fstop && shot.focus !== undefined) {
        const aperture = f / 1000 / shot.fstop;           // entrance pupil diameter (m)
        const ax = film.sub.ax * aperture, ay = film.sub.ay * aperture;
        cam.matrixWorld.extractBasis(s.right, s.up, s.fwd);
        cam.position.addScaledVector(s.right, ax).addScaledVector(s.up, ay);
        cam.updateMatrixWorld(true);
        P[8] += -P[0] * ax / focus;
        P[9] += -P[5] * ay / focus;
      }
      // sub-pixel jitter (anti-aliasing)
      P[8] += (2 * film.sub.jx) / size.width;
      P[9] += (2 * film.sub.jy) / size.height;
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    }
  });
  return null;
}
