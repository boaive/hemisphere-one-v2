import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { film, span, seat, smooth, clamp01 } from '../../film/clock';
import { DATACENTER as DC } from '../../film/shots';
import { rbox, merge, place, instanced, mesh, mat, rand, iSection } from '../geo';
import { anchor } from '../anchors';
import { mats } from '../materials';

/**
 * 03 / PANELIZED CONSTRUCTION: a hyperscale data hall on a steel frame, closed in with vertical insulated wall
 * panels (the roof is a structural deck, not panels). Frame first, then the panels go up bay by bay, course by
 * course, set by a mobile crane that follows the install front. Dark lower course, light upper course, a louvre
 * band, loading docks with safety-yellow bollards, rooftop chillers and a generator yard.
 */
const W = DC.w, D = DC.d, H = 13.6, LOW = 6.0, PW = 1.2;       // footprint, parapet height, lower course, panel width
const BAY = 7.5;

type Panel = { m: THREE.Matrix4; t0: number; dur: number; out: THREE.Vector3; upper: boolean; hero?: boolean };
/** the one panel set on camera (panelized shot 10.8-16.0 s): south wall, lower course, this column */
const HERO_COL = 35, HERO_T0 = 11.2, HERO_DUR = 4.2, BOOM = 26;

export function DataCenter() {
  const M = mats();
  const B = useMemo(() => {
    const g = new THREE.Group(); g.position.set(DC.x, 0, DC.z);
    const r = rand(73);
    const steel = new THREE.MeshStandardMaterial({ color: '#4d5560', metalness: 0.6, roughness: 0.45 });
    const lowMat = new THREE.MeshStandardMaterial({ color: '#2f343a', metalness: 0.35, roughness: 0.42 });
    const upMat = new THREE.MeshStandardMaterial({ color: '#c9ccce', metalness: 0.3, roughness: 0.4 });
    const louvre = new THREE.MeshStandardMaterial({ color: '#3a4047', metalness: 0.5, roughness: 0.5 });
    // slab
    const slab = mesh(rbox(W + 4, 0.4, D + 4, 0.05), M.concreteReal); slab.position.y = 0.2; g.add(slab);
    // steel frame: perimeter + interior columns on a 7.5 m grid, eaves beams, roof beams
    const col = iSection(H - 0.4, 0.4, 0.3);
    const cols: THREE.Matrix4[] = [];
    for (let x = -W / 2; x <= W / 2 + 0.01; x += BAY) for (const z of [-D / 2, D / 2]) cols.push(mat(x, 0.4 + (H - 0.4) / 2, z));
    for (let z = -D / 2 + 12; z < D / 2 - 1; z += 12) for (const x of [-W / 2, W / 2]) cols.push(mat(x, 0.4 + (H - 0.4) / 2, z));
    for (let x = -W / 2 + BAY * 2; x < W / 2 - 1; x += BAY * 2) for (let z = -D / 2 + 12; z < D / 2 - 1; z += 12) cols.push(mat(x, 0.4 + (H - 0.4) / 2, z));
    const colMesh = instanced(col, steel, cols); g.add(colMesh);
    const beams: THREE.BufferGeometry[] = [];
    for (const y of [LOW, H - 0.35]) {
      beams.push(place(rbox(W, 0.5, 0.3, 0.02), 0, y, -D / 2), place(rbox(W, 0.5, 0.3, 0.02), 0, y, D / 2));
      beams.push(place(rbox(0.3, 0.5, D, 0.02), -W / 2, y, 0), place(rbox(0.3, 0.5, D, 0.02), W / 2, y, 0));
    }
    for (let x = -W / 2 + BAY; x < W / 2; x += BAY) beams.push(place(rbox(0.25, 0.6, D, 0.02), x, H - 0.4, 0));
    const beamMesh = mesh(merge(beams), steel); g.add(beamMesh);
    // roof deck (structural, appears once the frame is up) and parapet cap
    const deck = mesh(rbox(W, 0.25, D, 0.02), new THREE.MeshStandardMaterial({ color: '#5b6066', roughness: 0.8 }));
    deck.position.y = H - 0.15; g.add(deck);
    // wall panels: vertical, two courses, openings for docks and doors, a louvre band on the long north wall
    const panels: Panel[] = [];
    const docks = [-24, -18, -12];        // loading doors along the south wall (x centres)
    const doors = [10, 22];
    // timeline (all off camera): frame 0-2.6 s, roof deck 2.4-4.2 s, walls closed in by 10.2 s. On camera the crane
    // sets the last lower-course panel of the dock wall (see HERO_*).
    const run = (len: number, place2: (s: number, upper: boolean, h: number, y: number) => THREE.Matrix4, out: THREE.Vector3, skip: (s: number) => boolean, t0: number, t1: number, hero = -1) => {
      const n = Math.floor(len / PW);
      for (let i = 0; i < n; i++) {
        const s = -len / 2 + PW / 2 + i * PW;
        const ts = t0 + (i / n) * (t1 - t0);
        if (!skip(s)) panels.push(i === hero ? { m: place2(s, false, LOW, LOW / 2), t0: HERO_T0, dur: HERO_DUR, out, upper: false, hero: true } : { m: place2(s, false, LOW, LOW / 2), t0: ts, dur: 0.55, out, upper: false });
        panels.push({ m: place2(s, true, H - LOW, LOW + (H - LOW) / 2), t0: ts + 0.25, dur: 0.55, out, upper: true });
      }
    };
    const near = (s: number, list: number[], w: number) => list.some((c) => Math.abs(s - c) < w);
    run(W, (s, _u, h, y) => mat(s, y + 0.4, D / 2 + 0.16, 0, 0, 0, 1, h / LOW, 1), new THREE.Vector3(0, 3, 6), (s) => near(s, docks, 2.0) || near(s, doors, 0.7), 6.4, 10.2, HERO_COL);
    run(D, (s, _u, h, y) => mat(W / 2 + 0.16, y + 0.4, -s, 0, Math.PI / 2, 0, 1, h / LOW, 1), new THREE.Vector3(6, 3, 0), () => false, 2.6, 5.0);
    run(W, (s, _u, h, y) => mat(-s, y + 0.4, -D / 2 - 0.16, 0, Math.PI, 0, 1, h / LOW, 1), new THREE.Vector3(0, 3, -6), () => false, 3.6, 7.6);
    run(D, (s, _u, h, y) => mat(-W / 2 - 0.16, y + 0.4, s, 0, -Math.PI / 2, 0, 1, h / LOW, 1), new THREE.Vector3(-6, 3, 0), () => false, 5.0, 9.0);
    const pGeo = merge([place(rbox(PW - 0.02, LOW, 0.2, 0.01, 1), 0, 0, 0), place(new THREE.BoxGeometry(0.03, LOW * 0.98, 0.21), PW / 2 - 0.01, 0, 0)]);
    const lower = panels.filter((p) => !p.upper), upper = panels.filter((p) => p.upper);
    const lowMesh = instanced(pGeo, lowMat, lower.map(() => new THREE.Matrix4()));
    const upMesh = instanced(pGeo, upMat, upper.map(() => new THREE.Matrix4()));
    g.add(lowMesh, upMesh);
    // louvre band on the north wall (appears with its panels)
    const lv = mesh(merge(Array.from({ length: 18 }, (_, i) => place(rbox(W - 8, 0.1, 0.35, 0.02), 0, 9.2 + i * 0.16, -D / 2 - 0.4, -0.5, 0, 0))), louvre); g.add(lv);
    // dock doors, shelters and safety-yellow bollards
    const dockG: THREE.BufferGeometry[] = [], bollards: THREE.Matrix4[] = [];
    docks.forEach((x) => {
      dockG.push(place(rbox(3.4, 3.6, 0.12, 0.02), x, 0.4 + 1.8 + 1.0, D / 2 + 0.25));
      dockG.push(place(rbox(4.2, 0.5, 0.9, 0.03), x, 0.4 + 4.0 + 0.6, D / 2 + 0.6));
      for (const sx of [-2.4, 2.4]) bollards.push(mat(x + sx, 0.9, D / 2 + 1.2));
    });
    doors.forEach((x) => dockG.push(place(rbox(1.2, 2.3, 0.1, 0.02), x, 0.4 + 1.15, D / 2 + 0.25)));
    const dockMesh = mesh(merge(dockG), new THREE.MeshStandardMaterial({ color: '#6c737a', metalness: 0.5, roughness: 0.45 })); g.add(dockMesh);
    const bollardMesh = instanced(new THREE.CylinderGeometry(0.11, 0.11, 1.0, 14), new THREE.MeshStandardMaterial({ color: '#fcd301', roughness: 0.4 }), bollards); g.add(bollardMesh);
    // rooftop chillers (two rows) and a generator yard along the east side
    const chiller = merge([place(rbox(6, 2.2, 2.4, 0.05), 0, 1.1, 0), ...[-2, 0, 2].map((x) => place(new THREE.CylinderGeometry(0.85, 0.85, 0.3, 24), x, 2.35, 0))]);
    const chillers: THREE.Matrix4[] = [];
    for (let i = 0; i < Math.floor((W - 22) / 9) + 1; i++) for (const z of [-7, 7]) chillers.push(mat(-W / 2 + 11 + i * 9, H, z));
    const chillMesh = instanced(chiller, new THREE.MeshStandardMaterial({ color: '#d9dcde', metalness: 0.4, roughness: 0.45 }), chillers); g.add(chillMesh);
    const gens: THREE.Matrix4[] = [];
    for (let i = 0; i < 6; i++) gens.push(mat(W / 2 + 9, 1.5, -D / 2 + 6 + i * 7, 0, Math.PI / 2, 0));
    const genMesh = instanced(rbox(6.1, 2.6, 2.44, 0.04), new THREE.MeshStandardMaterial({ color: '#e4e2dc', metalness: 0.3, roughness: 0.5 }), gens); g.add(genMesh);
    const fence = mesh(merge([place(rbox(0.06, 2.4, D + 12, 0.01), W / 2 + 14, 1.2, 0), place(rbox(14, 2.4, 0.06, 0.01), W / 2 + 7, 1.2, -D / 2 - 2), place(rbox(14, 2.4, 0.06, 0.01), W / 2 + 7, 1.2, D / 2 + 2)]), new THREE.MeshStandardMaterial({ color: '#7a8086', metalness: 0.5, roughness: 0.5, transparent: true, opacity: 0.55 }));
    g.add(fence);
    // the mobile crane that sets the last panel: parked broadside to the dock wall, upper + boom aim at the hook
    const heroS = -W / 2 + PW / 2 + HERO_COL * PW;
    const SEAT = new THREE.Vector3(heroS, 0.4 + LOW / 2, D / 2 + 0.16);
    const RACK = new THREE.Vector3(heroS - 4, 0.35 + LOW / 2, D / 2 + 6);
    const CR = new THREE.Vector3(heroS + 9, 0, D / 2 + 15);
    const crane = new THREE.Group(); crane.position.copy(CR); crane.rotation.y = Math.PI / 2;
    crane.add(mesh(merge([place(rbox(2.6, 1.4, 11, 0.08), 0, 1.4, 0), place(rbox(2.5, 1.7, 2.3, 0.15), 0, 2.5, 4.8)]), M.steelYellowCrane));
    crane.add(instanced(new THREE.CylinderGeometry(0.6, 0.6, 0.5, 18).rotateZ(Math.PI / 2), M.tyre, [-4, -2.2, 2.4, 4.4].flatMap((z) => [mat(-1.35, 0.6, z), mat(1.35, 0.6, z)])));
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const leg = mesh(rbox(3.0, 0.3, 0.3, 0.03), M.steelYellowCrane); leg.position.set(sx * 2.4, 0.9, sz * 3.6); crane.add(leg);
      const pad = mesh(rbox(0.8, 0.12, 0.8, 0.02), new THREE.MeshStandardMaterial({ color: '#2c2f33', roughness: 0.8 })); pad.position.set(sx * 3.8, 0.06, sz * 3.6); crane.add(pad);
    }
    g.add(crane);
    const pivot = new THREE.Vector3(CR.x, 3.8, CR.z);
    const upperC = new THREE.Group(); upperC.position.set(CR.x, 2.6, CR.z); g.add(upperC);
    upperC.add(mesh(rbox(2.6, 1.7, 4.2, 0.1), M.steelYellowCrane));
    const boom = new THREE.Group(); boom.position.copy(pivot); boom.rotation.order = 'YXZ'; g.add(boom);
    boom.add(mesh(new THREE.BoxGeometry(0.7, 0.7, BOOM).translate(0, 0, BOOM / 2), M.steelYellowCrane));
    const hookBlk = mesh(rbox(0.45, 0.7, 0.45, 0.05), M.steelYellowCrane); g.add(hookBlk);
    // stillage (A-frame rack) with the waiting panels leaning on it
    const rack = mesh(merge([place(rbox(4.6, 0.3, 2.4, 0.02), 0, 0.15, 0), place(rbox(0.16, 4.4, 0.16, 0.01), -2.1, 2.3, -0.5, 0.18, 0, 0), place(rbox(0.16, 4.4, 0.16, 0.01), 2.1, 2.3, -0.5, 0.18, 0, 0)]), new THREE.MeshStandardMaterial({ color: '#4d5560', metalness: 0.6, roughness: 0.45 }));
    rack.position.set(RACK.x, 0, RACK.z); g.add(rack);
    const pGeoR = merge([place(rbox(PW - 0.02, LOW, 0.2, 0.01, 1), 0, 0, 0), place(new THREE.BoxGeometry(0.03, LOW * 0.98, 0.21), PW / 2 - 0.01, 0, 0)]);
    g.add(instanced(pGeoR, lowMat, [mat(RACK.x - 1.3, RACK.y, RACK.z - 0.5), mat(RACK.x + 1.3, RACK.y, RACK.z - 0.5)]));
    const fly = mesh(pGeoR, lowMat); g.add(fly);
    const cable = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 6).translate(0, -0.5, 0), M.wire, false); g.add(cable);
    void r;
    return { g, lower, upper, lowMesh, upMesh, lv, deck, upperC, boom, hookBlk, fly, cable, chillMesh, colMesh, beamMesh, dockMesh, bollardMesh, panelsAll: panels, SEAT, RACK, pivot };
  }, [M]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), z: new THREE.Matrix4().makeScale(0, 0, 0), w: new THREE.Vector3() }), []);

  useFrame(() => {
    const t = film.scene === 1 ? film.t : 99, b = B;
    b.g.visible = film.scene === 1;
    if (!b.g.visible) return;
    // frame rises 0-2.6 s (columns grow from their base plates), roof deck from 2.2 s
    const fr = seat(span(t, 0.0, 2.6));
    b.colMesh.scale.y = Math.max(0.001, fr); b.beamMesh.visible = t > 1.6; b.deck.visible = t > 2.4;
    b.deck.scale.set(Math.max(0.01, smooth(span(t, 2.4, 4.2))), 1, 1);
    // panels: flown in from outside and seated (off camera); the hero panel only appears once it is set
    const animate = (inst: THREE.InstancedMesh, list: Panel[]) => {
      list.forEach((p, i) => {
        const a = clamp01((t - p.t0) / p.dur);
        if (a <= 0 || (p.hero && a < 1)) { inst.setMatrixAt(i, tmp.z); return; }
        const e = seat(a);
        p.m.decompose(tmp.p, tmp.q, tmp.s);
        if (!p.hero) tmp.p.addScaledVector(p.out, 1 - e);
        tmp.m.compose(tmp.p, tmp.q, tmp.s);
        inst.setMatrixAt(i, tmp.m);
      });
      inst.instanceMatrix.needsUpdate = true;
    };
    animate(b.lowMesh, b.lower); animate(b.upMesh, b.upper);
    b.lv.visible = t > 7.6;
    b.chillMesh.visible = t > 9.0;
    // the hero lift: rack -> lift -> swing -> lower -> push onto the wall (eased phases, one move at a time)
    const a = (t - HERO_T0) / HERO_DUR;
    const P = tmp.w;
    let attached = true;
    if (a <= 0) P.copy(b.RACK);
    else if (a >= 1) { P.copy(b.SEAT); attached = false; }
    else {
      const lift = seat(span(a, 0.0, 0.24)), move = smooth(span(a, 0.2, 0.66)), lower = smooth(span(a, 0.64, 0.88)), push = seat(span(a, 0.86, 1.0));
      const yHi = b.SEAT.y + 2.6;
      P.set(b.RACK.x + (b.SEAT.x - b.RACK.x) * move, 0, b.RACK.z + (b.SEAT.z + 1.2 - b.RACK.z) * move);
      P.z += (b.SEAT.z - (b.SEAT.z + 1.2)) * push * (move >= 1 ? 1 : 0);
      P.y = b.RACK.y + (yHi - b.RACK.y) * lift;
      P.y += (b.SEAT.y - yHi) * lower;
    }
    b.fly.visible = a < 1;
    b.fly.position.copy(P);
    // hook: on the panel's top while attached; after release it lifts clear (eased)
    const rise = attached ? 0 : smooth(clamp01((t - HERO_T0 - HERO_DUR) / 1.2)) * 2.4;
    const hx = P.x, hy = P.y + LOW / 2 + 0.75 + rise, hz = P.z + (attached ? 0 : 0.8 * smooth(clamp01((t - HERO_T0 - HERO_DUR) / 1.2)));
    b.hookBlk.position.set(hx, hy, hz);
    // boom: slew + luff so the tip sits right above the hook
    const dx = hx - b.pivot.x, dz = hz - b.pivot.z, dh = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz), elev = Math.acos(Math.min(0.97, Math.max(0.15, dh / BOOM)));
    b.boom.rotation.set(-elev, yaw, 0);
    b.upperC.rotation.y = yaw;
    const tipY = b.pivot.y + Math.sin(elev) * BOOM;
    const tipX = b.pivot.x + Math.sin(yaw) * Math.cos(elev) * BOOM, tipZ = b.pivot.z + Math.cos(yaw) * Math.cos(elev) * BOOM;
    b.cable.position.set(tipX, tipY, tipZ); b.cable.scale.set(1, Math.max(0.2, tipY - hy - 0.35), 1);
    anchor('factory', DC.x + P.x, P.y + LOW / 2 + 1, DC.z + P.z);
  });

  return <primitive object={B.g} />;
}
