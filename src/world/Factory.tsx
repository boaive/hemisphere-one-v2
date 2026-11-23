import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { film, span, seat, smooth, clamp01 } from '../film/clock';
import { FACTORY as F } from '../film/shots';
import { mats } from './materials';
import { rbox, merge, place, instanced, mesh, mat, iSection, rod, rand, boxUVWorld } from './geo';
import { anchor } from './anchors';

/**
 * 03 / PANELIZED CONSTRUCTION - a 40 m span x 150 m steel portal-frame factory closed with 2D prefabricated
 * insulated wall and roof panels (not room modules). Frames -> secondaries -> wall panels -> roof -> flashings.
 */
const SPAN = F.x1 - F.x0, XM = (F.x0 + F.x1) / 2;
const NB = Math.round((F.z0 - F.z1) / F.bay);      // 20 bays, 21 frames
const SLOPE = Math.atan2(F.ridge - F.eave, SPAN / 2);
const RAFTER = Math.hypot(SPAN / 2, F.ridge - F.eave);
const PW = 1.0;                                      // panel module width

type P = { m: THREE.Matrix4; t0: number; dur: number; out: THREE.Vector3 };

function frameGeometry() {
  const col = iSection(F.eave, 0.6, 0.25);
  const parts = [place(col.clone(), F.x0, F.eave / 2, 0), place(col.clone(), F.x1, F.eave / 2, 0)];
  const raf = iSection(RAFTER + 0.4, 0.55, 0.22).rotateZ(Math.PI / 2);
  parts.push(place(raf.clone(), 0, 0, 0, 0, 0, SLOPE).translate(F.x0 + SPAN / 4, (F.eave + F.ridge) / 2 + 0.1, 0));
  parts.push(place(raf.clone(), 0, 0, 0, 0, 0, -SLOPE).translate(F.x1 - SPAN / 4, (F.eave + F.ridge) / 2 + 0.1, 0));
  // haunches + apex plate + base plates
  parts.push(place(rbox(1.6, 0.9, 0.24, 0.01), F.x0 + 0.6, F.eave - 0.2, 0, 0, 0, SLOPE));
  parts.push(place(rbox(1.6, 0.9, 0.24, 0.01), F.x1 - 0.6, F.eave - 0.2, 0, 0, 0, -SLOPE));
  parts.push(place(rbox(0.8, 0.9, 0.26, 0.01), XM, F.ridge + 0.05, 0));
  parts.push(place(rbox(0.7, 0.04, 0.5, 0.005), F.x0, 0.02, 0));
  parts.push(place(rbox(0.7, 0.04, 0.5, 0.005), F.x1, 0.02, 0));
  return merge(parts);
}

export function Factory() {
  const M = mats();
  const built = useMemo(() => {
    const g = new THREE.Group();
    const r = rand(31);
    // slab + footings
    const slab = mesh(boxUVWorld(rbox(SPAN + 6, 0.3, F.z0 - F.z1 + 6, 0.03), 0.2), M.concrete);
    slab.position.set(XM, 0.15, (F.z0 + F.z1) / 2); g.add(slab);
    // frames (rise in sequence)
    const fgeo = frameGeometry();
    const frames: { z: number; t0: number }[] = Array.from({ length: NB + 1 }, (_, k) => ({ z: F.z0 - k * F.bay, t0: 0.2 + k * 0.12 }));
    const frameMesh = instanced(fgeo, M.steelPrimer, frames.map(() => new THREE.Matrix4()));
    g.add(frameMesh);
    // secondaries: purlins along the roof, girts on the walls, end-bay X-bracing
    const len = F.z0 - F.z1;
    const purlinGeo = rbox(0.07, 0.2, len, 0.004, 1);
    const sec: THREE.Matrix4[] = [];
    for (let i = 0; i <= 12; i++) {
      const d = 0.5 + i * (RAFTER - 0.8) / 12;
      for (const side of [-1, 1]) {
        const x = XM + side * (SPAN / 2 - d * Math.cos(SLOPE));
        const y = F.ridge + 0.4 - (SPAN / 2 - Math.abs(x - XM)) * 0 - (Math.abs(x - XM)) * Math.tan(SLOPE) + 0.0;
        sec.push(mat(x, F.ridge + 0.45 - Math.abs(x - XM) * Math.tan(SLOPE), (F.z0 + F.z1) / 2, 0, 0, side * SLOPE));
        void y;
      }
    }
    for (let h = 1.8; h < F.eave; h += 1.9) for (const x of [F.x0 - 0.42, F.x1 + 0.42]) sec.push(mat(x, h, (F.z0 + F.z1) / 2));
    const secMesh = instanced(purlinGeo, M.steelGalv, sec, { shadow: false });
    g.add(secMesh);
    const brace = merge([0, NB - 1].flatMap((k) => {
      const za = F.z0 - k * F.bay, zb = za - F.bay;
      return [F.x0 - 0.3, F.x1 + 0.3].flatMap((x) => [rod(new THREE.Vector3(x, 0.5, za), new THREE.Vector3(x, F.eave - 0.5, zb), 0.02, 5), rod(new THREE.Vector3(x, F.eave - 0.5, za), new THREE.Vector3(x, 0.5, zb), 0.02, 5)]);
    }));
    const braceMesh = mesh(brace, M.steelGalv, false); g.add(braceMesh);

    // wall panels (long walls, x0 side faces the camera track), gable panels, roof panels
    const wallGeo = boxUVWorld(rbox(PW - 0.01, F.eave + 0.3, 0.1, 0.008), 0.25);
    const walls: P[] = [];
    let k = 0;
    for (let z = F.z0 - PW / 2; z > F.z1; z -= PW, k++) {
      const jit = r() * 0.12;
      walls.push({ m: mat(F.x0 - 0.52, (F.eave + 0.3) / 2, z, 0, Math.PI / 2, 0), t0: 3.6 + (k / 150) * 8.8 + jit, dur: 0.34 + r() * 0.12, out: new THREE.Vector3(-2.4, 1.8, 0) });
      walls.push({ m: mat(F.x1 + 0.52, (F.eave + 0.3) / 2, z, 0, -Math.PI / 2, 0), t0: 4.4 + (k / 150) * 9.6 + jit, dur: 0.34 + r() * 0.12, out: new THREE.Vector3(2.4, 1.8, 0) });
    }
    // gables: panels fill up to the rafter line; roller-door openings on the near gable
    for (let x = F.x0 + PW / 2; x < F.x1; x += PW) {
      const hh = F.eave + (SPAN / 2 - Math.abs(x - XM)) * Math.tan(SLOPE);
      const door = Math.abs(x - (XM - 9)) < 3 || Math.abs(x - (XM + 9)) < 3;
      for (const [z, dir, t0] of [[F.z0 + 0.52, 1, 7.6], [F.z1 - 0.52, -1, 12.4]] as const) {
        const y0 = door && dir === 1 ? 6.2 : 0;
        const h = hh - y0;
        walls.push({ m: mat(x, y0 + h / 2, z, 0, 0, 0, 1, h / (F.eave + 0.3), 1), t0: t0 + ((x - F.x0) / SPAN) * 1.8 + r() * 0.1, dur: 0.32, out: new THREE.Vector3(0, 1.6, dir * 2.2) });
      }
    }
    const wallMesh = instanced(wallGeo, M.panelWall, walls.map((p) => p.m));
    g.add(wallMesh);
    const roofGeo = boxUVWorld(rbox(PW - 0.01, 0.1, RAFTER + 0.5, 0.008), 0.25).rotateY(Math.PI / 2);
    const roofs: P[] = [];
    k = 0;
    for (let z = F.z0 - PW / 2; z > F.z1; z -= PW, k++) {
      for (const side of [-1, 1]) {
        const cx = XM + side * (SPAN / 4), cy = (F.eave + F.ridge) / 2 + 0.72;
        roofs.push({ m: mat(cx, cy, z, 0, 0, side * SLOPE), t0: 8.8 + (k / 150) * 7.4 + (side > 0 ? 0.3 : 0) + r() * 0.08, dur: 0.38, out: new THREE.Vector3(0, 2.8, 0) });
      }
    }
    const roofMesh = instanced(roofGeo, M.panelRoof, roofs.map((p) => p.m));
    g.add(roofMesh);
    // roller doors + flashings (ridge cap, eave gutters, corner trims)
    const doors = instanced(boxUVWorld(rbox(5.8, 6.0, 0.12, 0.01), 0.5), M.claddingDark, [mat(XM - 9, 3.0, F.z0 + 0.6), mat(XM + 9, 3.0, F.z0 + 0.6)]);
    g.add(doors);
    const flash = mesh(merge([
      place(rbox(0.9, 0.25, len + 1, 0.01), XM, F.ridge + 0.82, (F.z0 + F.z1) / 2),
      place(rbox(0.35, 0.3, len + 1, 0.01), F.x0 - 0.75, F.eave + 0.55, (F.z0 + F.z1) / 2),
      place(rbox(0.35, 0.3, len + 1, 0.01), F.x1 + 0.75, F.eave + 0.55, (F.z0 + F.z1) / 2),
      ...[F.z0 + 0.6, F.z1 - 0.6].flatMap((z) => [place(rbox(0.25, F.eave + 0.5, 0.25, 0.01), F.x0 - 0.55, (F.eave + 0.5) / 2, z), place(rbox(0.25, F.eave + 0.5, 0.25, 0.01), F.x1 + 0.55, (F.eave + 0.5) / 2, z)]),
    ]), M.claddingDark);
    g.add(flash);

    // mobile crane working the west wall
    const mc = new THREE.Group();
    const carrier = mesh(merge([place(rbox(2.6, 1.4, 10, 0.08), 0, 1.3, 0), place(rbox(2.5, 1.6, 2.2, 0.15), 0, 2.4, 4.6)]), M.steelYellowCrane);
    const upper = mesh(rbox(2.4, 1.6, 4, 0.1), M.steelYellowCrane); upper.position.set(0, 2.8, -1.5);
    const boom = mesh(new THREE.BoxGeometry(0.7, 0.7, 22).translate(0, 0, 11), M.steelYellowCrane); boom.position.set(0, 3.4, -1.5); boom.rotation.x = -1.05;
    const wheels = instanced(new THREE.CylinderGeometry(0.55, 0.55, 0.45, 14).rotateZ(Math.PI / 2), M.tyre, [-3.5, -1.8, 2.5, 4.2].flatMap((z) => [mat(-1.3, 0.55, z), mat(1.3, 0.55, z)]));
    mc.add(carrier, upper, boom, wheels);
    mc.position.set(F.x0 - 16, 0, F.z0 - 6);
    g.add(mc);
    // delivered panel stacks along the access road
    const stacks = instanced(merge(Array.from({ length: 10 }, (_, i) => place(rbox(1.0, 0.1, 12.3, 0.005), 0, 0.15 + i * 0.11, 0))), M.panelWall,
      Array.from({ length: 6 }, (_, i) => mat(F.x0 - 15, 0, F.z0 - 20 - i * 22)));
    g.add(stacks);
    return { g, frames, frameMesh, secMesh, braceMesh, walls, wallMesh, roofs, roofMesh, doors, flash, mc, boom };
  }, [M]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), z: new THREE.Matrix4().makeScale(0, 0, 0) }), []);

  useFrame(() => {
    const t = film.scene === 1 ? film.t : 99, b = built;   // complete in Scenes 2-3
    // frames rise from their base plates (columns + rafters as one erected portal)
    b.frames.forEach((f, i) => {
      const a = seat(span(t, f.t0, f.t0 + 0.45));
      tmp.m.compose(tmp.p.set(0, 0, f.z), tmp.q.identity(), tmp.s.set(1, Math.max(0.0001, a), 1));
      b.frameMesh.setMatrixAt(i, a <= 0 ? tmp.z : tmp.m);
    });
    b.frameMesh.instanceMatrix.needsUpdate = true;
    const sec = smooth(span(t, 2.2, 3.6));
    b.secMesh.visible = sec > 0.01;
    b.secMesh.scale.set(1, 1, Math.max(0.01, sec));
    // secondaries run out from the near gable: scale about z0 (instances sit at the mid-point)
    b.secMesh.position.z = F.z0 * (1 - sec);
    b.braceMesh.visible = t > 2.6;
    // panels: delivered outside + above, then seated; each with its own duration
    const animate = (inst: THREE.InstancedMesh, list: P[]) => {
      let front = -1;
      list.forEach((p, i) => {
        const a = clamp01((t - p.t0) / p.dur);
        if (a <= 0) { inst.setMatrixAt(i, tmp.z); return; }
        if (a < 1 && front < 0) front = i;
        const e = seat(a);
        p.m.decompose(tmp.p, tmp.q, tmp.s);
        tmp.p.addScaledVector(p.out, 1 - e);
        tmp.m.compose(tmp.p, tmp.q, tmp.s);
        inst.setMatrixAt(i, tmp.m);
      });
      inst.instanceMatrix.needsUpdate = true;
      return front;
    };
    const fw = animate(b.wallMesh, b.walls);
    animate(b.roofMesh, b.roofs);
    b.doors.visible = t > 15.6;
    b.flash.visible = t > 16.4;
    b.flash.scale.set(1, 1, Math.max(0.01, smooth(span(t, 16.4, 17.2))));
    // the mobile crane follows the west-wall install front
    const fz = fw >= 0 ? new THREE.Vector3().setFromMatrixPosition(b.walls[fw].m).z : (t < 3.6 ? F.z0 : F.z1 + 4);
    b.mc.position.z = t < 3.6 ? F.z0 + 2 : fz + 4;
    b.mc.position.x = F.x0 - 16;
    // label pin follows the roof install front (what the panelized shot is watching)
    const rf = b.roofs.find((p) => t < p.t0 + p.dur);
    const rz = rf ? new THREE.Vector3().setFromMatrixPosition(rf.m).z : F.z1 + 20;
    anchor('factory', F.x0 + 6, F.eave + 2.2, Math.min(F.z0 - 20, rz + 6));
  });

  return <primitive object={built.g} />;
}
