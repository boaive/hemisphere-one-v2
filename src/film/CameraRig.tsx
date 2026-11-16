import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { film, stepClock, span, easeInOut, FILM_DURATION } from './clock';
import { sampleTrack } from './track';
import { POS, TGT, LENS, BANK, DOLLY } from './shots';
import { projectAnchors } from '../world/anchors';

// the dolly-zoom end point closes the position track (key at t = 37)
{
  const k = POS.find((p) => p.t === 37.0)!;
  const d1 = DOLLY.d0 * (DOLLY.f1 / DOLLY.f0);
  k.v = [DOLLY.head[0] + DOLLY.dir[0] * d1, DOLLY.head[1] + DOLLY.dir[1] * d1, DOLLY.head[2] + DOLLY.dir[2] * d1];
}

/** single virtual cinema camera: full-frame 36 mm gauge, spline position + separate look-at + focal length + bank */
export function CameraRig() {
  const { camera, size } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const s = useMemo(() => ({ p: [0, 0, 0], q: [0, 0, 0], f: [24], b: [0], v: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), []);

  useFrame((state, dt) => {
    stepClock(dt);
    const t = Math.min(film.t, FILM_DURATION);
    sampleTrack(POS, t, s.p);
    sampleTrack(TGT, t, s.q);
    sampleTrack(LENS, t, s.f);
    sampleTrack(BANK, t, s.b);
    let f = s.f[0];
    // shot 8: true dolly zoom - subject size constant: distance scales with focal length
    if (t >= DOLLY.t0 && t <= DOLLY.t1) {
      const u = easeInOut(span(t, DOLLY.t0, DOLLY.t1));
      f = DOLLY.f0 + (DOLLY.f1 - DOLLY.f0) * u;
      const d = DOLLY.d0 * (f / DOLLY.f0);
      s.p[0] = DOLLY.head[0] + DOLLY.dir[0] * d; s.p[1] = DOLLY.head[1] + DOLLY.dir[1] * d; s.p[2] = DOLLY.head[2] + DOLLY.dir[2] * d;
      s.q[0] = DOLLY.subject[0]; s.q[1] = DOLLY.subject[1]; s.q[2] = DOLLY.subject[2];
    }
    // mobile: independent framing - pull back from the look-at (more on wide shots), lens recomputed on the portrait gauge
    if (film.mobile && !(t >= DOLLY.t0 && t <= DOLLY.t1)) {
      const k = t < 19 || t > 54 ? 1.22 : 1.12;
      for (let i = 0; i < 3; i++) s.p[i] = s.q[i] + (s.p[i] - s.q[i]) * k;
      s.p[1] = Math.max(s.p[1], t < 19 ? 1.9 : 1.45);   // never push the camera under the ground (low-angle opening)
      f *= t < 19 || t > 54 ? 0.8 : 0.9;   // portrait gauge: a touch wider so the architecture fits without distortion
    }
    // landing state: the camera settles, then breathes very slowly (no looping animation)
    if (film.t > FILM_DURATION) {
      const w = state.clock.elapsedTime * 0.08;
      s.p[0] += Math.sin(w) * 1.6; s.p[1] += Math.sin(w * 0.7) * 0.8;
    }
    cam.position.set(s.p[0], s.p[1], s.p[2]);
    cam.up.copy(s.up);
    cam.lookAt(s.q[0], s.q[1], s.q[2]);
    cam.rotateZ((s.b[0] * Math.PI) / 180);
    cam.filmGauge = 36;
    cam.setFocalLength(f);
    // depth range by scale of the scene (city vs human)
    const human = t > 22.2 && t < 54.5;
    cam.near = human ? 0.06 : 0.6;
    cam.far = human ? 2600 : 7000;
    cam.updateProjectionMatrix();
    projectAnchors(cam, size.width, size.height);
  });
  return null;
}
