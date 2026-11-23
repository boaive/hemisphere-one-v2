import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { film, span, seat, smooth, clamp01, lerp } from '../film/clock';
import { PRECAST } from '../film/shots';
import { mats } from './materials';
import { rbox, merge, place, instanced, mesh, mat, boxUVWorld } from './geo';
import { anchor } from './anchors';

/**
 * 02 / VOLUMETRIC PRECAST - a 9-storey mid-rise of three-dimensional room modules on a cast podium.
 * Modules are craned from a trailer: lift -> slew/trolley -> lower -> pause above bearings -> seat (8 mm settle).
 */
export const MW = 3.6, MH = 3.3, MD = 9.0;
const COLS = 6, ROWS = 2, LEVELS = 8;
export const PODIUM = 4.2;
const X0 = PRECAST.x - (COLS * MW) / 2 + MW / 2;
const ZF = PRECAST.z + MD / 2, ZB = PRECAST.z - MD / 2;     // row centres (front row faces +Z)
const CRANE = new THREE.Vector3(PRECAST.x - 20, 0, PRECAST.z + 4);   // west of the block, clear of the Aluform shot
const PICK = new THREE.Vector3(PRECAST.x + 2, 1.25, PRECAST.z + 24);   // trailer parked in front of the building
const CRANE_H = 46;

type Slot = { x: number; y: number; z: number; front: boolean; t0: number; t1: number; hero?: boolean };

export function moduleGeometry() {
  const t = 0.14;
  const parts = [
    place(rbox(MW, 0.2, MD, 0.015), 0, 0.1, 0),                         // floor slab
    place(rbox(MW, 0.16, MD, 0.015), 0, MH - 0.08, 0),                  // ceiling slab
    place(rbox(t, MH - 0.36, MD, 0.01), -MW / 2 + t / 2, MH / 2, 0),    // long walls
    place(rbox(t, MH - 0.36, MD, 0.01), MW / 2 - t / 2, MH / 2, 0),
  ];
  // exterior end (+Z): window opening 2.0 x 1.55 (sill 0.9)
  const ez = MD / 2 - t / 2;
  parts.push(place(rbox(MW, 0.72, t, 0.01), 0, 0.2 + 0.36, ez));
  parts.push(place(rbox(MW, MH - 0.36 - 2.27, t, 0.01), 0, 2.47 + (MH - 0.16 - 2.47) / 2, ez));
  parts.push(place(rbox(0.8, 1.55, t, 0.01), -MW / 2 + 0.4, 0.92 + 0.775, ez));
  parts.push(place(rbox(0.8, 1.55, t, 0.01), MW / 2 - 0.4, 0.92 + 0.775, ez));
  // interior end (-Z): door opening 1.0 x 2.1
  const iz = -MD / 2 + t / 2;
  parts.push(place(rbox(1.3, MH - 0.36, t, 0.01), -MW / 2 + 0.65, MH / 2, iz));
  parts.push(place(rbox(1.3, MH - 0.36, t, 0.01), MW / 2 - 0.65, MH / 2, iz));
  parts.push(place(rbox(1.0, MH - 0.36 - 2.1, t, 0.01), 0, 0.2 + 2.1 + (MH - 0.36 - 2.1) / 2, iz));
  // lifting loops at the 4 top corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    parts.push(place(new THREE.TorusGeometry(0.07, 0.018, 6, 12).rotateY(Math.PI / 2), sx * (MW / 2 - 0.35), MH + 0.05, sz * (MD / 2 - 0.8)));
  }
  return boxUVWorld(merge(parts), 0.4);
}

/** facade cassette applied to the exterior end after installation: frame + glazing + sill */
export function claddingGeometry() {
  const parts = [
    place(rbox(MW - 0.02, 0.62, 0.06, 0.008), 0, 0.5, 0),
    place(rbox(MW - 0.02, 0.9, 0.06, 0.008), 0, MH - 0.45, 0),
    place(rbox(0.72, 1.6, 0.06, 0.008), -MW / 2 + 0.37, 1.7, 0),
    place(rbox(0.72, 1.6, 0.06, 0.008), MW / 2 - 0.37, 1.7, 0),
  ];
  return merge(parts);
}

export function Precast() {
  const M = mats();
  const built = useMemo(() => {
    const g = new THREE.Group();
    // install schedule (Scene 1 hyper-lapse): levels 0-4 stand at the start; level 5 onward is craned in.
    // The hero lift (level 6, front row, slot 3) plays at a readable pace inside the precast shot (9.6-13.0 s).
    const slots: Slot[] = [];
    for (let j = 0; j < LEVELS; j++) for (let r = 0; r < ROWS; r++) for (let i = 0; i < COLS; i++) {
      slots.push({ x: X0 + i * MW, y: PODIUM + j * MH, z: r === 0 ? ZF : ZB, front: r === 0, t0: -1, t1: -1 });
    }
    // levels 0-5 stand, plus level 6's back row and first two front slots; then one module at a time, each lift
    // ~4 s with a return swing between (the hero lift plays inside the precast shot, 5.6-10.8 s)
    const lv = (s: Slot) => Math.round((s.y - PODIUM) / MH), col = (s: Slot) => Math.round((s.x - X0) / MW);
    const find = (l: number, front: boolean, c: number) => slots.find((s) => lv(s) === l && s.front === front && col(s) === c)!;
    const preList = slots.filter((s) => lv(s) <= 5 || (lv(s) === 6 && (!s.front || col(s) <= 1)));
    const lifts: [Slot, number, number][] = [[find(6, true, 2), 0.6, 4.4], [find(6, true, 3), 5.9, 10.5], [find(6, true, 4), 11.6, 15.6], [find(6, true, 5), 16.8, 20.8]];
    lifts.forEach(([s, a, b]) => { s.t0 = a; s.t1 = b; });
    const hero = lifts[1][0]; hero.hero = true;
    const rest = slots.filter((s) => !preList.includes(s) && !lifts.some(([l]) => l === s));
    rest.forEach((s) => { s.t0 = 999; s.t1 = 999; });
    const order = [...preList, ...lifts.map(([s]) => s), ...rest];
    const HERO = hero;

    const mgeo = moduleGeometry();
    const placed = instanced(mgeo, M.precast, order.map((s) => mat(s.x, s.y, s.z, 0, s.front ? 0 : Math.PI, 0)));
    g.add(placed);
    const cgeo = claddingGeometry();
    const facadeMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.62, metalness: 0.05 });   // cladding cassettes, tinted per column
    const colPal = ['#ecebe6', '#ecebe6', '#3b4147', '#ecebe6', '#b98a5e', '#ecebe6'].map((c) => new THREE.Color(c));
    const clad = instanced(cgeo, facadeMat, order.map((s) => mat(s.x, s.y, s.z + (s.front ? MD / 2 + 0.035 : -MD / 2 - 0.035), 0, s.front ? 0 : Math.PI, 0)), { shadow: false, colors: order.map((s) => colPal[Math.round((s.x - X0) / MW) % colPal.length]) });
    g.add(clad);
    const glassGeo = new THREE.BoxGeometry(1.7, 1.35, 0.03);
    const glass = instanced(glassGeo, M.glassDistrict, order.map((s) => mat(s.x, s.y + 1.7, s.z + (s.front ? MD / 2 - 0.05 : -MD / 2 + 0.05), 0, 0, 0)), { shadow: false });
    g.add(glass);
    // the module in the air
    const flying = mesh(mgeo, M.precast); g.add(flying);

    // podium (cast in situ) + core
    const podium = mesh(boxUVWorld(merge([
      place(rbox(COLS * MW + 1, 0.4, ROWS * MD + 1, 0.02), 0, PODIUM - 0.2, 0),
      ...Array.from({ length: 4 }, (_, i) => place(rbox(0.6, PODIUM - 0.4, 0.6, 0.02), -COLS * MW / 2 + 0.3 + i * (COLS * MW - 0.6) / 3, (PODIUM - 0.4) / 2, MD - 0.3)),
      ...Array.from({ length: 4 }, (_, i) => place(rbox(0.6, PODIUM - 0.4, 0.6, 0.02), -COLS * MW / 2 + 0.3 + i * (COLS * MW - 0.6) / 3, (PODIUM - 0.4) / 2, -MD + 0.3)),
    ]), 0.4), M.concrete);
    podium.position.set(PRECAST.x, 0, PRECAST.z); g.add(podium);
    const shop = mesh(new THREE.BoxGeometry(COLS * MW - 0.4, PODIUM - 0.6, ROWS * MD - 0.6), M.glassReal);
    shop.position.set(PRECAST.x, (PODIUM - 0.4) / 2, PRECAST.z); g.add(shop);
    const coreH = PODIUM + LEVELS * MH + 1.2;
    const core = mesh(boxUVWorld(rbox(5.2, coreH, 7.2, 0.04), 0.4), M.concrete);
    core.position.set(PRECAST.x - COLS * MW / 2 - 2.6, coreH / 2, PRECAST.z); g.add(core);

    // tower crane: mast + slewing upper (jib, counter-jib, trolley, hook, rigging)
    const crane = new THREE.Group(); crane.position.copy(CRANE);
    const mast = mesh(new THREE.BoxGeometry(1.8, CRANE_H, 1.8), M.lattice, false); mast.position.y = CRANE_H / 2; crane.add(mast);
    const spine = mesh(new THREE.BoxGeometry(0.7, CRANE_H, 0.7), M.steelYellowCrane); spine.position.y = CRANE_H / 2; crane.add(spine);
    const slew = new THREE.Group(); slew.position.y = CRANE_H; crane.add(slew);
    const jib = mesh(new THREE.BoxGeometry(46, 1.6, 1.4), M.lattice, false); jib.position.x = 22; slew.add(jib);
    const chord = mesh(new THREE.BoxGeometry(59, 0.4, 0.7), M.steelYellowCrane); chord.position.set(15.5, 0.6, 0); slew.add(chord);
    const cj = mesh(new THREE.BoxGeometry(13, 1.4, 1.4), M.lattice, false); cj.position.x = -7; slew.add(cj);
    const cw = mesh(rbox(3, 2.4, 2.0, 0.05), M.concrete); cw.position.set(-12, -1.2, 0); slew.add(cw);
    const cab = mesh(rbox(2, 2.2, 2, 0.08), M.cladding); cab.position.set(1.5, -1.6, 1.5); slew.add(cab);
    const apex = mesh(new THREE.BoxGeometry(1.2, 8, 1.2), M.lattice, false); apex.position.y = 4; slew.add(apex);
    const trolley = mesh(rbox(1.6, 0.6, 1.6, 0.05), M.steelYellowCrane); trolley.position.y = -1.0; slew.add(trolley);
    g.add(crane);
    const hook = mesh(rbox(0.5, 0.8, 0.5, 0.06), M.steelYellowCrane); g.add(hook);
    const cable = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 5).translate(0, -0.5, 0), M.wire, false); g.add(cable);
    const slings = Array.from({ length: 4 }, () => { const s = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4).translate(0, -0.5, 0), M.wire, false); g.add(s); return s; });
    // delivery trailer at the pick point
    const trailer = mesh(merge([place(rbox(3.0, 0.25, 11, 0.04), 0, 1.0, 0), place(rbox(2.6, 2.6, 2.4, 0.15), 0, 1.5, 7.2)]), M.claddingDark);
    trailer.position.set(PICK.x, 0, PICK.z); g.add(trailer);
    const wheels = instanced(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 16).rotateZ(Math.PI / 2), M.tyre, [-4, -3, 4, 7].flatMap((z) => [mat(PICK.x - 1.3, 0.5, PICK.z + z), mat(PICK.x + 1.3, 0.5, PICK.z + z)]));
    g.add(wheels);
    return { g, order, placed, clad, glass, flying, slew, trolley, hook, cable, slings, HERO };
  }, [M]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), hide: new THREE.Matrix4().makeScale(0, 0, 0), v: new THREE.Vector3() }), []);

  useFrame(() => {
    const t = film.scene === 1 ? film.t : 99;   // complete in Scenes 2-3 (distant skyline)
    const b = built;
    let done = 0, active: Slot | null = null, prev: Slot | null = null, next: Slot | null = null;
    for (const s of b.order) {
      if (s.t0 < 0) { done++; continue; }
      if (t >= s.t1) { done++; prev = s; continue; }
      if (t >= s.t0) active = s; else if (s.t0 < 900) next = s;
      break;
    }
    b.placed.count = done;
    // cladding follows ~0.8 s after each install; glass likewise
    let cl = 0;
    for (const s of b.order) { if (s.t0 < 0 || t >= s.t1 + 0.8) cl++; else break; }
    b.clad.count = cl; b.glass.count = cl;

    // crane state
    const rel = (p: THREE.Vector3) => ({ a: Math.atan2(-(p.z - CRANE.z), p.x - CRANE.x), r: Math.hypot(p.x - CRANE.x, p.z - CRANE.z) });
    const pick = rel(PICK);
    let a = pick.a, r = pick.r, y = PICK.y, hookY = PICK.y + MH + 2.2, carrying = false;
    if (active) {
      const u = span(t, active.t0, active.t1);
      const dst = rel(new THREE.Vector3(active.x, 0, active.z));
      const top = active.y + MH + 4;
      const lift = seat(span(u, 0.0, 0.25));
      const move = smooth(span(u, 0.22, 0.66));
      const lower = smooth(span(u, 0.64, 0.88));
      const settle = seat(span(u, active.hero ? 0.94 : 0.9, 1.0));
      a = lerp(pick.a, dst.a, move); r = lerp(pick.r, dst.r, move);
      y = lerp(lerp(PICK.y, top, lift), active.y + 0.15, lower) - settle * 0.158;
      carrying = u < 0.97;
      const px = CRANE.x + r * Math.cos(a), pz = CRANE.z - r * Math.sin(a);
      b.flying.visible = true;
      b.flying.position.set(px, y, pz);
      b.flying.rotation.set(0, active.front ? 0 : Math.PI, 0);
      hookY = y + MH + 2.2;
      if (active.hero) anchor('precast', px, y + MH * 0.5, pz);
    } else {
      // between lifts: the hook swings back to the trailer (eased, with a little clearance lift) and the next
      // module waits on the trailer bed, already slung
      const ret = prev ? Math.min(1.2, (next ? next.t0 : 1e9) - prev.t1) : 0;
      if (prev && t < prev.t1 + ret) {
        const k = smooth((t - prev.t1) / ret), d = rel(new THREE.Vector3(prev.x, 0, prev.z));
        a = lerp(d.a, pick.a, k); r = lerp(d.r, pick.r, k);
        hookY = lerp(prev.y + MH + 2.2, PICK.y + MH + 2.2, k) + Math.sin(Math.PI * k) * 4;
      }
      const waiting = !!next && !(prev && t < prev.t1 + ret);
      b.flying.visible = !!next;
      if (next) { b.flying.position.set(PICK.x, PICK.y, PICK.z); b.flying.rotation.set(0, next.front ? 0 : Math.PI, 0); }
      carrying = waiting;
    }
    if (!active) anchor('precast', b.HERO.x, b.HERO.y + MH * 0.5, ZF + MD / 2);
    b.slew.rotation.y = a;
    b.trolley.position.x = r;
    const hx = CRANE.x + r * Math.cos(a), hz = CRANE.z - r * Math.sin(a);
    b.hook.position.set(hx, hookY, hz);
    b.cable.position.set(hx, CRANE_H - 1.3, hz);
    b.cable.scale.set(1, Math.max(0.1, CRANE_H - 1.3 - hookY), 1);
    const slung = active ?? next;
    b.slings.forEach((s, i) => {
      s.visible = carrying && !!slung;
      if (!slung || !s.visible) return;
      const sx = (i % 2 ? 1 : -1) * (MW / 2 - 0.35), sz = (i < 2 ? 1 : -1) * (MD / 2 - 0.8) * (slung.front ? 1 : -1);
      const p0 = new THREE.Vector3(hx, hookY - 0.4, hz);
      const p1 = new THREE.Vector3(b.flying.position.x + sx, b.flying.position.y + MH + 0.08, b.flying.position.z + sz);
      const d = p1.clone().sub(p0);
      s.position.copy(p0);
      s.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d.clone().normalize());
      s.scale.set(1, d.length(), 1);
    });
    void clamp01; void tmp;
  });

  return <primitive object={built.g} />;
}
