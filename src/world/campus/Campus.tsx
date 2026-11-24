import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { film, span, seat } from '../../film/clock';
import { CAMPUS, DATACENTER as DC, PRECAST, TOWER } from '../../film/shots';
import { rbox, merge, place, instanced, mesh, mat, rand } from '../geo';
import { mats, patchScan } from '../materials';
import { earth, withRepeat } from '../textures';
import { towerFloors } from '../Tower';

/**
 * Film 01's controlled environment: one compact, organised construction site holding the three systems side by
 * side (Aluform tower in the centre, the precast mid-rise front-left, the panelized data hall to the right).
 * Inside one hoarding line: a road loop, site offices, a batching plant, laydown yards, a stationary pump feeding
 * the tower, a boom pump pouring the dock apron, trucks on their runs and crews at every front. Everything is
 * driven by film time, so any frame renders on its own.
 */
export const paint = (c: string, rough = 0.5, metal = 0.2) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
const { x0, x1, z0, z1 } = CAMPUS;
const LOOP = { x0: x0 + 12, x1: x1 - 12, z0: z0 - 14, z1: z1 + 12 };
const SPUR_X = 22, YARD_Z = 44, CROSS_Z = -80, WEST_X = -100;
const APRON = { x0: -70, x1: -32, z0: -36, z1: -12 };   // next block's raft, being poured (north of the precast)

/** smooth value noise for macro ground variation (breaks texture tiling at aerial distances) */
function noise2(seed: number) {
  const h = (x: number, z: number) => { const s = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); };
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (x: number, z: number) => {
    const xi = Math.floor(x), zi = Math.floor(z), xf = sm(x - xi), zf = sm(z - zi);
    const a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1);
    return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
  };
}

/** ground plane with per-vertex tint (macro variation, track wear) multiplied over a fine PBR texture */
function groundPlane(w: number, d: number, step: number, tint: (x: number, z: number) => [number, number, number]) {
  const g = new THREE.PlaneGeometry(w, d, Math.round(w / step), Math.round(d / step)).rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const c = tint(p.getX(i), p.getZ(i)); col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function truckGeo(kind: 'mixer' | 'flatbed' | 'pump') {
  const cab = merge([place(rbox(2.5, 2.4, 2.3, 0.2), 0, 1.75, 3.7), place(rbox(2.42, 0.95, 1.5, 0.12), 0, 3.25, 3.45), place(rbox(2.3, 0.35, 0.2, 0.05), 0, 0.85, 4.9)]);
  const glass = merge([place(new THREE.BoxGeometry(2.2, 0.9, 0.04), 0, 2.45, 4.86), place(new THREE.BoxGeometry(0.04, 0.8, 1.2), 1.26, 2.45, 3.8), place(new THREE.BoxGeometry(0.04, 0.8, 1.2), -1.26, 2.45, 3.8)]);
  const chassis = merge([place(rbox(2.2, 0.45, 9.0, 0.05), 0, 0.98, -0.4), place(rbox(2.5, 0.3, 1.6, 0.04), 0, 1.2, -4.6)]);
  let body: THREE.BufferGeometry;
  if (kind === 'mixer') {
    const drum = new THREE.LatheGeometry([[0, -2.6], [0.9, -2.4], [1.32, -1.2], [1.38, 0.2], [1.1, 1.8], [0.55, 2.6], [0.4, 2.8]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
    body = merge([drum.rotateX(Math.PI / 2 - 0.2).translate(0, 2.65, -1.3), place(rbox(0.9, 0.7, 0.9, 0.05), 0, 3.1, -4.4)]);
  } else if (kind === 'pump') {
    body = merge([place(rbox(2.4, 1.0, 6.6, 0.05), 0, 1.7, -1.4), place(new THREE.CylinderGeometry(0.9, 1.1, 1.0, 20), 0, 2.7, 0.8)]);
  } else body = place(rbox(2.5, 0.22, 8.6, 0.03), 0, 1.35, -1.0);
  return { cab, glass, chassis, body };
}
export const WHEELS = [3.6, -1.6, -3.0, -4.3];

/** a 4-section concrete boom pump unfolded toward the pour (truck at origin facing +z) */
function boomPump(reachDir: number, M: ReturnType<typeof mats>) {
  const o = new THREE.Group();
  const T = truckGeo('pump');
  const white = paint('#f2f2ef', 0.35, 0.3), grey = paint('#5a6168', 0.5, 0.4), boomM = paint('#f2f2ef', 0.32, 0.35);
  o.add(mesh(T.cab, white), mesh(T.glass, M.glassReal, false), mesh(T.chassis, grey), mesh(T.body, grey));
  o.add(instanced(new THREE.CylinderGeometry(0.52, 0.52, 2.5, 18).rotateZ(Math.PI / 2), M.tyre, WHEELS.map((z) => mat(0, 0.52, z))));
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const leg = mesh(rbox(3.2, 0.3, 0.3, 0.03), grey); leg.position.set(sx * 2.6, 1.0, sz * 2.4); leg.rotation.y = sz * sx * 0.35; o.add(leg);
    const pad = mesh(rbox(0.7, 0.12, 0.7, 0.02), paint('#2c2f33', 0.8, 0.1)); pad.position.set(sx * 4.0, 0.06, sz * 2.9); o.add(pad);
  }
  const turret = new THREE.Group(); turret.position.set(0, 3.2, 0.8); turret.rotation.y = reachDir; o.add(turret);
  const secs: [number, number, number][] = [[11, 0.85, 0.55], [10, -0.1, 0.45], [9, -0.75, 0.38], [6, -1.35, 0.3]];
  let px = 0, py = 0;
  secs.forEach(([len, ang, th]) => {
    const cx = px + (Math.cos(ang) * len) / 2, cy = py + (Math.sin(ang) * len) / 2;
    const s = mesh(rbox(th, th * 1.1, len, 0.04), boomM); s.position.set(0, cy, cx); s.rotation.x = -ang; turret.add(s);
    const pipe = mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 8).rotateX(Math.PI / 2), M.tyre); pipe.position.set(th * 0.7, cy, cx); pipe.rotation.x = -ang; turret.add(pipe);
    px += Math.cos(ang) * len; py += Math.sin(ang) * len;
  });
  const hose = mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 8), M.tyre); hose.position.set(0, py - 1.5, px); turret.add(hose);
  return o;
}

/** hydraulic excavator (tracked), arm curled into a dig */
export function excavator(M: ReturnType<typeof mats>) {
  const o = new THREE.Group();
  const y = M.steelYellowCrane, dark = paint('#2a2d30', 0.7, 0.3);
  o.add(mesh(merge([place(rbox(0.7, 0.9, 4.4, 0.2), 1.25, 0.45, 0), place(rbox(0.7, 0.9, 4.4, 0.2), -1.25, 0.45, 0)]), dark));
  const up = new THREE.Group(); up.position.y = 1.0; up.rotation.y = 0.5; o.add(up);
  up.add(mesh(rbox(2.6, 1.1, 3.4, 0.12), y));
  const cabin = mesh(rbox(1.0, 1.6, 1.2, 0.1), y); cabin.position.set(0.75, 1.3, 0.6); up.add(cabin);
  const cw = mesh(rbox(2.5, 0.9, 0.8, 0.12), dark); cw.position.set(0, 0.5, -1.8); up.add(cw);
  const boom = mesh(rbox(0.45, 0.5, 4.6, 0.06), y); boom.position.set(-0.3, 2.3, 2.6); boom.rotation.x = -0.55; up.add(boom);
  const arm = mesh(rbox(0.35, 0.4, 3.0, 0.05), y); arm.position.set(-0.3, 2.4, 5.6); arm.rotation.x = 0.9; up.add(arm);
  const bucket = mesh(rbox(0.9, 0.7, 0.8, 0.1), dark); bucket.position.set(-0.3, 0.9, 6.4); up.add(bucket);
  return o;
}

export function Campus() {
  const M = mats();
  const B = useMemo(() => {
    const g = new THREE.Group();
    const r = rand(11);
    const n1 = noise2(1), n2 = noise2(2), n3 = noise2(3);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const H = TOWER.half;

    // ---------------- ground: a vast graded plain fading into haze; the compacted site pad inside the hoarding
    const W = x1 - x0, D = z0 - z1;
    const grit = earth(13, true);
    const padMat = patchScan(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, normalMap: withRepeat(grit, W / 2.5, D / 2.5).normalMap, normalScale: new THREE.Vector2(0.5, 0.5) }), 0.5);
    const onRoad = (x: number, z: number) => Math.min(Math.abs(z - LOOP.z0), Math.abs(z - LOOP.z1), Math.abs(x - LOOP.x0), Math.abs(x - LOOP.x1), Math.abs(x - SPUR_X), Math.abs(z - YARD_Z) + (x < SPUR_X ? 99 : 0), Math.abs(z - CROSS_Z), Math.abs(x - WEST_X) + (z < CROSS_Z ? 99 : 0));
    const pad = mesh(groundPlane(W, D, 1.5, (lx, lz) => {
      const x = lx + cx, z = lz + cz;
      let v = 0.56 + 0.05 * (n1(x / 40, z / 40) - 0.5) + 0.035 * (n3(x / 7, z / 7) - 0.5) + 0.02 * (n2(x / 2.2, z / 2.2) - 0.5);
      const rd = onRoad(x, z);
      if (rd > 4.5 && rd < 9) v *= 0.92 + 0.08 * Math.min(1, (rd - 4.5) / 4.5);
      return [0.96 * v, 0.92 * v, 0.85 * v];
    }), padMat, false);
    pad.position.set(cx, 0.0, cz); pad.receiveShadow = true; g.add(pad);
    // roads: asphalt loop + spurs with dashed centre lines; concrete aprons round each building
    const asphalt = new THREE.MeshStandardMaterial({ color: '#7c8086', roughness: 0.84, normalMap: withRepeat(grit, 120, 120).normalMap, normalScale: new THREE.Vector2(0.25, 0.25) });
    const lw = LOOP.x1 - LOOP.x0, ld = LOOP.z0 - LOOP.z1, lcx = (LOOP.x0 + LOOP.x1) / 2, lcz = (LOOP.z0 + LOOP.z1) / 2;
    const roadG = [
      place(new THREE.BoxGeometry(lw + 9, 0.06, 9), lcx, 0.03, LOOP.z0), place(new THREE.BoxGeometry(lw + 9, 0.06, 9), lcx, 0.03, LOOP.z1),
      place(new THREE.BoxGeometry(9, 0.06, ld - 9), LOOP.x0, 0.03, lcz), place(new THREE.BoxGeometry(9, 0.06, ld - 9), LOOP.x1, 0.03, lcz),
      place(new THREE.BoxGeometry(9, 0.06, ld - 9), SPUR_X, 0.03, lcz),
      place(new THREE.BoxGeometry(lw - 9, 0.06, 9), lcx, 0.03, CROSS_Z),
      place(new THREE.BoxGeometry(9, 0.06, LOOP.z0 - CROSS_Z - 9), WEST_X, 0.03, (LOOP.z0 + CROSS_Z) / 2),
      place(new THREE.BoxGeometry(LOOP.x1 - SPUR_X - 4.5, 0.06, 9), (LOOP.x1 + SPUR_X) / 2, 0.03, YARD_Z),
      place(new THREE.BoxGeometry(9, 0.06, LOOP.z0 - 42), PRECAST.x + 2, 0.03, (LOOP.z0 + 42) / 2),
      place(new THREE.BoxGeometry(14, 0.06, 18), -20, 0.03, z0 - 2),
    ];
    g.add(Object.assign(mesh(merge(roadG), asphalt, false), { receiveShadow: true }));
    const lines: THREE.BufferGeometry[] = [];
    for (let x = LOOP.x0 + 8; x < LOOP.x1 - 6; x += 7) for (const z of [LOOP.z0, LOOP.z1]) lines.push(place(new THREE.BoxGeometry(3, 0.02, 0.15), x, 0.07, z));
    for (let z = LOOP.z1 + 8; z < LOOP.z0 - 6; z += 7) for (const x of [LOOP.x0, LOOP.x1, SPUR_X]) lines.push(place(new THREE.BoxGeometry(0.15, 0.02, 3), x, 0.07, z));
    for (let x = LOOP.x0 + 8; x < LOOP.x1 - 6; x += 7) lines.push(place(new THREE.BoxGeometry(3, 0.02, 0.15), x, 0.07, CROSS_Z));
    for (let z = CROSS_Z + 8; z < LOOP.z0 - 6; z += 7) lines.push(place(new THREE.BoxGeometry(0.15, 0.02, 3), WEST_X, 0.07, z));
    g.add(mesh(merge(lines), paint('#eeece6', 0.6, 0), false));
    const apronMat = new THREE.MeshStandardMaterial({ color: '#dcd9d3', roughness: 0.88, normalMap: withRepeat(grit, 30, 30).normalMap, normalScale: new THREE.Vector2(0.2, 0.2) });
    const aprons = [
      place(new THREE.BoxGeometry(2 * H + 18, 0.08, 2 * H + 18), 0, 0.04, 0),
      place(new THREE.BoxGeometry(34, 0.08, 30), PRECAST.x, 0.04, PRECAST.z + 2),
      place(new THREE.BoxGeometry(DC.w + 10, 0.08, DC.d + 8), DC.x, 0.04, DC.z),
    ];
    g.add(Object.assign(mesh(merge(aprons), apronMat, false), { receiveShadow: true }));
    // the dock apron being poured: fresh concrete (dark, wet sheen) spreads behind the boom pump over a laid mesh
    const fresh = mesh(new THREE.BoxGeometry(1, 0.5, APRON.z1 - APRON.z0 - 0.2), paint('#77746e', 0.2, 0), false);
    fresh.receiveShadow = true; g.add(fresh);
    const rw = APRON.x1 - APRON.x0, rd2 = APRON.z1 - APRON.z0, rcx = (APRON.x0 + APRON.x1) / 2, rcz = (APRON.z0 + APRON.z1) / 2;
    g.add(mesh(merge([
      place(rbox(rw, 0.6, 0.08, 0.01), rcx, 0.3, APRON.z1), place(rbox(rw, 0.6, 0.08, 0.01), rcx, 0.3, APRON.z0),
      place(rbox(0.08, 0.6, rd2, 0.01), APRON.x1, 0.3, rcz), place(rbox(0.08, 0.6, rd2, 0.01), APRON.x0, 0.3, rcz),
    ]), M.timber));
    const blinding = mesh(new THREE.BoxGeometry(rw, 0.06, rd2), paint('#a9a49b', 0.95, 0), false); blinding.position.set(rcx, 0.03, rcz); blinding.receiveShadow = true; g.add(blinding);
    const gridTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 9); x.fillRect(0, 0, 9, 64); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set((APRON.x1 - APRON.x0) / 0.25, (APRON.z1 - APRON.z0) / 0.25); return t; })();
    const apronMesh = mesh(new THREE.PlaneGeometry(APRON.x1 - APRON.x0, APRON.z1 - APRON.z0).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6e5546', metalness: 0.5, roughness: 0.7, alphaMap: gridTex, alphaTest: 0.5 }), false);
    apronMesh.position.set((APRON.x0 + APRON.x1) / 2, 0.42, (APRON.z0 + APRON.z1) / 2); g.add(apronMesh);
    const chairs = mesh(new THREE.PlaneGeometry(APRON.x1 - APRON.x0, APRON.z1 - APRON.z0).rotateX(-Math.PI / 2), apronMesh.material as THREE.Material, false);
    chairs.position.set((APRON.x0 + APRON.x1) / 2, 0.14, (APRON.z0 + APRON.z1) / 2); g.add(chairs);

    // ---------------- hoarding: graphite panels, brand-yellow cap line, two gates
    const hoard: THREE.BufferGeometry[] = [], cap: THREE.BufferGeometry[] = [], posts: THREE.Matrix4[] = [];
    const side = (ax: number, az: number, bx: number, bz: number, gaps: number[] = []) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / 3.6);
      const ry = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, x = ax + (bx - ax) * u, z = az + (bz - az) * u;
        if (gaps.some((gp) => Math.abs(u - gp) * len < 7)) continue;
        hoard.push(place(new THREE.BoxGeometry(3.58, 2.4, 0.06), x, 1.2, z, 0, ry, 0));
        cap.push(place(new THREE.BoxGeometry(3.6, 0.14, 0.09), x, 2.47, z, 0, ry, 0));
        posts.push(mat(x, 1.25, z, 0, ry, 0));
      }
    };
    side(x0, z0, x1, z0, [(-20 - x0) / (x1 - x0)]); side(x1, z0, x1, z1); side(x1, z1, x0, z1, [0.62]); side(x0, z1, x0, z0);
    g.add(mesh(merge(hoard), paint('#2b3137', 0.62, 0.15)), mesh(merge(cap), paint('#fcd301', 0.45, 0.1), false));

    // ---------------- site offices: two-storey cabin block with glazed fronts, walkway and stair; parking
    const cabM: THREE.Matrix4[] = [], winM: THREE.Matrix4[] = [];
    const OX = x0 + 16, OZ = -30;
    for (let i = 0; i < 7; i++) for (let lv = 0; lv < 2; lv++) {
      const z = OZ + i * 6.2, y = 1.45 + lv * 2.78;
      cabM.push(mat(OX, y, z, 0, Math.PI / 2, 0)); winM.push(mat(OX + 1.24, y + 0.25, z, 0, Math.PI / 2, 0));
    }
    g.add(instanced(rbox(6.0, 2.66, 2.44, 0.05), paint('#edece8', 0.5, 0.15), cabM), instanced(new THREE.BoxGeometry(4.4, 1.05, 0.05), M.glassReal, winM, { shadow: false }));
    g.add(mesh(merge([place(rbox(1.4, 0.12, 6.2 * 7, 0.02), OX + 1.95, 2.85, OZ + 18.6), place(rbox(0.05, 1.0, 6.2 * 7, 0.01), OX + 2.62, 3.4, OZ + 18.6),
      place(rbox(1.2, 0.12, 6, 0.02), OX + 2.0, 1.45, OZ - 5.5, -0.45, 0, 0)]), paint('#4a5157', 0.5, 0.5)));
    const cars: THREE.Matrix4[] = [], carCols: THREE.Color[] = [];
    const carPal = ['#e8e8e6', '#2b2f34', '#9aa1a8', '#e8e8e6', '#5b6a78', '#c9ccce', '#1f2327'];
    for (let i = 0; i < 9; i++) { cars.push(mat(OX + 12, 0, OZ - 2 + i * 3.1, 0, Math.PI / 2, 0)); carCols.push(new THREE.Color(carPal[i % carPal.length])); }
    const carGeo = merge([place(rbox(4.5, 0.75, 1.85, 0.25), 0, 0.62, 0), place(rbox(2.5, 0.62, 1.7, 0.3), -0.2, 1.25, 0)]);
    g.add(instanced(carGeo, paint('#ffffff', 0.25, 0.6), cars, { colors: carCols }));
    g.add(instanced(new THREE.BoxGeometry(2.0, 0.42, 1.75), paint('#1a1d20', 0.1, 0.4), cars.map((m) => m.clone().multiply(mat(-0.2, 1.3, 0))), { shadow: false }));

    // ---------------- batching plant (north-west): silos, mixer tower, aggregate bins + stockpiles, conveyor
    const BX = -36, BZ = -48;
    const silos: THREE.Matrix4[] = [];
    for (let i = 0; i < 4; i++) silos.push(mat(BX - 9 + i * 5.4, 11, BZ - 4));
    g.add(instanced(merge([new THREE.CylinderGeometry(2.3, 2.3, 13, 32), place(new THREE.ConeGeometry(2.3, 2.6, 32).rotateX(Math.PI), 0, -7.8, 0), place(new THREE.CylinderGeometry(2.32, 2.32, 0.3, 32), 0, 6.6, 0),
      place(rbox(0.2, 9, 0.2, 0.02), 1.6, -9.5, 1.6), place(rbox(0.2, 9, 0.2, 0.02), -1.6, -9.5, 1.6), place(rbox(0.2, 9, 0.2, 0.02), 1.6, -9.5, -1.6), place(rbox(0.2, 9, 0.2, 0.02), -1.6, -9.5, -1.6)]), paint('#e2e4e3', 0.35, 0.45), silos));
    const plantT = mesh(merge([place(rbox(8, 13, 7, 0.1), 0, 6.5, 0), place(rbox(9.5, 0.6, 8.5, 0.05), 0, 13.3, 0), place(rbox(4, 3, 4, 0.08), 0, 15.1, 0)]), paint('#a9b0b5', 0.45, 0.4));
    plantT.position.set(BX + 16, 0, BZ - 2); g.add(plantT);
    const stripe = mesh(rbox(8.05, 0.8, 7.05, 0.02), paint('#fcd301', 0.45, 0.1), false); stripe.position.set(BX + 16, 11.4, BZ - 2); g.add(stripe);
    const conv = mesh(rbox(17, 0.5, 1.3, 0.04), paint('#596168', 0.5, 0.45));
    conv.position.set(BX + 25, 7, BZ - 2); conv.rotation.z = 0.62; g.add(conv);
    const bins = mesh(merge([0, 1, 2].map((i) => place(rbox(5, 3.2, 5.6, 0.06), -5.4 + i * 5.4, 1.6, 0))), paint('#c4c7c9', 0.6, 0.3)); bins.position.set(BX + 36, 0, BZ - 2); g.add(bins);
    const piles: [number, number, number, number, string][] = [[BX + 40, BZ - 12, 5.5, 3.6, '#c9b99c'], [BX + 46, BZ + 2, 5, 3.2, '#8f8a82'], [BX - 20, BZ - 6, 6, 3.8, '#a49d92']];
    piles.forEach(([x, z, rr, h, c]) => { const p = mesh(new THREE.ConeGeometry(rr, h, 28, 1), paint(c, 1, 0)); p.position.set(x, h / 2, z); p.scale.z = 0.8; g.add(p); });

    // ---------------- laydown yards: formwork stacks, rebar bundles, panel crates, timber
    const alu: THREE.Matrix4[] = [], rebar: THREE.Matrix4[] = [], crates: THREE.Matrix4[] = [], timber: THREE.Matrix4[] = [];
    for (let i = 0; i < 6; i++) alu.push(mat(SPUR_X + 8 + (i % 3) * 4.2, 0.55, YARD_Z + 8 + Math.floor(i / 3) * 4.4));
    for (let i = 0; i < 8; i++) rebar.push(mat(SPUR_X + 22 + (i % 4) * 2.2, 0.3, YARD_Z + 8 + Math.floor(i / 4) * 7.5));
    for (let i = 0; i < 8; i++) crates.push(mat(DC.x + 8 + (i % 4) * 3.4, 0.75, YARD_Z + 9 + Math.floor(i / 4) * 7));
    for (let i = 0; i < 5; i++) timber.push(mat(-8 + i * 3.0, 0.4, 34));
    g.add(instanced(merge(Array.from({ length: 8 }, (_, k) => place(rbox(2.7, 0.1, 0.62, 0.01), 0, k * 0.11, 0))).translate(0, 0.08, 0), M.aluminium, alu));
    g.add(instanced(merge(Array.from({ length: 30 }, (_, k) => place(new THREE.CylinderGeometry(0.016, 0.016, 12, 5).rotateX(Math.PI / 2), (k % 6) * 0.05 - 0.13, Math.floor(k / 6) * 0.05, 0))), M.rebar, rebar, { shadow: true }));
    g.add(instanced(rbox(2.6, 1.3, 7.2, 0.03), paint('#c7cbcf', 0.5, 0.3), crates));
    g.add(instanced(merge([place(rbox(2.66, 0.14, 7.26, 0.01), 0, -0.2, 0), place(rbox(2.7, 0.12, 7.3, 0.01), 0, -0.66, 0)]), paint('#2f353b', 0.5, 0.3), crates, { shadow: false }));
    g.add(instanced(merge([0, 1, 2, 3].map((k) => place(rbox(1.1, 0.18, 4.8, 0.01), 0, k * 0.2, 0))), M.timber, timber));
    g.add(instanced(rbox(1.2, 0.14, 1.2, 0.02), M.timber, alu.map((m) => m.clone().multiply(mat(0, -0.48, 0))), { shadow: false }));

    // ---------------- precast module storage: finished room modules on dunnage, waiting for their lift slot
    const modM: THREE.Matrix4[] = [], modC: THREE.Color[] = [];
    const mPal = ['#ecebe6', '#ecebe6', '#3b4147', '#b98a5e'];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { modM.push(mat(-92 + i * 5.2, 1.85, 52 + j * 11, 0, 0, 0)); modC.push(new THREE.Color(mPal[(i + j) % mPal.length])); }
    const modGeo = merge([place(rbox(3.6, 3.3, 9.0, 0.02), 0, 0, 0), place(new THREE.BoxGeometry(2.0, 1.5, 0.06), 0, 0.2, 4.52), place(new THREE.BoxGeometry(2.0, 1.5, 0.06), 0, 0.2, -4.52)]);
    g.add(instanced(modGeo, paint('#ffffff', 0.7, 0.05), modM, { colors: modC }));
    g.add(instanced(merge([place(rbox(3.8, 0.2, 0.3, 0.01), 0, 0, -3.5), place(rbox(3.8, 0.2, 0.3, 0.01), 0, 0, 3.5)]), M.timber, modM.map((m) => m.clone().multiply(mat(0, -1.75, 0))), { shadow: false }));

    // ---------------- rebar fabrication shed: open steel canopy over benches, bundles and cut bars
    const shed = new THREE.Group(); shed.position.set(-6, 0, 52);
    const sCols: THREE.Matrix4[] = [];
    for (let i = 0; i < 4; i++) for (const z of [-5, 5]) sCols.push(mat(-9 + i * 6, 2.6, z));
    shed.add(instanced(rbox(0.22, 5.2, 0.22, 0.02), paint('#5b636a', 0.45, 0.6), sCols));
    const roof = mesh(rbox(20, 0.18, 12, 0.02), paint('#dfe2e4', 0.4, 0.5)); roof.position.y = 5.3; roof.rotation.x = 0.05; shed.add(roof);
    const benches: THREE.Matrix4[] = [];
    for (let i = 0; i < 3; i++) benches.push(mat(-5 + i * 5, 0.45, 0));
    shed.add(instanced(rbox(1.2, 0.9, 8, 0.03), paint('#3d4349', 0.5, 0.5), benches));
    shed.add(instanced(merge(Array.from({ length: 18 }, (_, k) => place(new THREE.CylinderGeometry(0.014, 0.014, 7.6, 5).rotateX(Math.PI / 2), (k % 6) * 0.06 - 0.15, 0.95 + Math.floor(k / 6) * 0.04, 0))), M.rebar, benches, { shadow: false }));
    g.add(shed);

    // ---------------- stationary concrete pump at the tower: pipeline up the east face to the active deck
    const pumpBase = mesh(merge([place(rbox(2.2, 1.6, 5.2, 0.08), 0, 1.25, 0), place(rbox(1.6, 0.8, 1.4, 0.05), 0, 2.4, 1.6)]), paint('#f2f2ef', 0.4, 0.3));
    pumpBase.position.set(H + 6, 0, 6); g.add(pumpBase);
    const pipeM = paint('#4e555c', 0.4, 0.7);
    const pipeV = mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 10).translate(0, 0.5, 0), pipeM); pipeV.position.set(H + 0.45, 0, 6); g.add(pipeV);
    const pipeH = mesh(new THREE.CylinderGeometry(0.09, 0.09, 5.4, 10).rotateZ(Math.PI / 2), pipeM); pipeH.position.set(H + 3.2, 0.6, 6); g.add(pipeH);

    // ---------------- boom pump pouring the dock apron
    const bp = boomPump(-Math.PI / 2 + 0.08, M); bp.position.set(APRON.x1 + 8, 0, (APRON.z0 + APRON.z1) / 2); g.add(bp);
    // shipping containers (stores, workshops) stacked along the north and west hoarding
    const cont: THREE.Matrix4[] = [], contC: THREE.Color[] = [];
    const cPal = ['#3c4a57', '#e3e1db', '#7d3a2e', '#2f3438', '#3c4a57', '#e3e1db'];
    for (let i = 0; i < 6; i++) for (let lv = 0; lv < (i % 3 === 1 ? 1 : 2); lv++) { cont.push(mat(48 + i * 7.6, 1.3 + lv * 2.6, z1 + 6.5, 0, Math.PI / 2, 0)); contC.push(new THREE.Color(cPal[(i + lv * 3) % cPal.length])); }
    for (let i = 0; i < 3; i++) { cont.push(mat(x0 + 6.5, 1.3, 22 + i * 3.0)); contC.push(new THREE.Color(cPal[(i + 1) % cPal.length])); }
    const contGeo = merge([place(rbox(2.44, 2.59, 12.1, 0.03), 0, 0, 0), ...Array.from({ length: 22 }, (_, k) => place(new THREE.BoxGeometry(2.46, 2.3, 0.08), 0, 0, -5.6 + k * 0.53))]);
    g.add(instanced(contGeo, paint('#ffffff', 0.55, 0.35), cont, { colors: contC }));

    // ---------------- excavator trimming the north-east corner, spoil heap
    const ex = excavator(M); ex.position.set(-78, 0.06, -97); ex.rotation.y = 0.7; g.add(ex);

    // ---------------- lighting masts
    const masts: THREE.Matrix4[] = [];
    for (const [x, z] of [[x0 + 6, z0 - 6], [x1 - 6, z0 - 6], [x0 + 6, z1 + 6], [x1 - 6, z1 + 6], [SPUR_X + 6, -60]]) masts.push(mat(x, 0, z));
    g.add(instanced(merge([place(new THREE.CylinderGeometry(0.16, 0.26, 20, 10), 0, 10, 0), place(rbox(2.6, 1.1, 0.35, 0.05), 0, 20.4, 0)]), paint('#8d949a', 0.45, 0.6), masts));

    // ---------------- trucks: mixers and flatbeds on the loop; one mixer at the boom pump, one under the plant
    const trucks: { obj: THREE.Group; off: number; speed: number }[] = [];
    const mixerG = truckGeo('mixer'), flatG = truckGeo('flatbed');
    const wheelGeo = new THREE.CylinderGeometry(0.52, 0.52, 2.5, 18).rotateZ(Math.PI / 2);
    const cabWhite = paint('#f3f3f1', 0.3, 0.35), chassisM = paint('#3b4146', 0.6, 0.4), drumM = paint('#e9e9e6', 0.35, 0.3), bandM = paint('#fcd301', 0.4, 0.1);
    const makeTruck = (mixer: boolean, load?: THREE.Object3D) => {
      const o = new THREE.Group(), G = mixer ? mixerG : flatG;
      o.add(mesh(G.cab, cabWhite), mesh(G.glass, M.glassReal, false), mesh(G.chassis, chassisM), mesh(G.body, mixer ? drumM : chassisM));
      if (mixer) { const band = mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.35, 28).rotateX(Math.PI / 2 - 0.2), bandM, false); band.position.set(0, 2.62, -1.0); o.add(band); }
      o.add(instanced(wheelGeo, M.tyre, WHEELS.map((z) => mat(0, 0.52, z))));
      if (load) o.add(load);
      return o;
    };
    for (let i = 0; i < 11; i++) {
      const mixer = i % 3 !== 2;
      const load = mixer ? undefined : mesh(rbox(2.4, 1.2, 7.0, 0.03).translate(0, 2.1, -1.0), paint('#30353b', 0.45, 0.4));
      const o = makeTruck(mixer, load); g.add(o);
      trucks.push({ obj: o, off: i / 11 + r() * 0.02, speed: 0.0048 + r() * 0.0012 });
    }
    const atPump = makeTruck(true); atPump.position.set(APRON.x1 + 8, 0, (APRON.z0 + APRON.z1) / 2 - 9.4); atPump.rotation.y = Math.PI; g.add(atPump);
    const atPlant = makeTruck(true); atPlant.position.set(BX + 16, 0, BZ - 2); atPlant.rotation.y = Math.PI / 2; g.add(atPlant);

    // ---------------- crews: hi-vis figures (navy trousers, orange vest, white helmet) at every front
    type Worker = { x: number; z: number; ph: number; walk: number; ry: number; deck?: boolean };
    const crew: Worker[] = [];
    const add = (x: number, z: number, n: number, sx: number, sz: number, walk = 0.4) => { for (let i = 0; i < n; i++) crew.push({ x: x + (r() - 0.5) * sx, z: z + (r() - 0.5) * sz, ph: r() * 6.28, walk: r() < walk ? 0.5 + r() : 0, ry: r() * 6.28 }); };
    for (let i = 0; i < 9; i++) crew.push({ x: (r() - 0.5) * (2 * H - 5), z: (r() - 0.5) * (2 * H - 5), ph: r() * 6.28, walk: 0, ry: r() * 6.28, deck: true });
    add(PRECAST.x + 7, PRECAST.z + 20, 6, 4, 10, 0.2);
    add(PRECAST.x, PRECAST.z + 12, 5, 18, 3, 0.2);
    add((APRON.x0 + APRON.x1) / 2, (APRON.z0 + APRON.z1) / 2, 14, APRON.x1 - APRON.x0 - 4, APRON.z1 - APRON.z0 - 4, 0.1);
    add(DC.x - DC.w / 2 - 6, DC.z, 5, 4, 20);
    add(SPUR_X + 14, YARD_Z + 12, 7, 20, 10);
    add(OX + 6, OZ + 10, 8, 6, 30, 0.6);
    add(BX + 10, BZ + 10, 4, 12, 10);
    add(H + 6, 9, 4, 4, 6, 0.2);
    add(-8, 30, 5, 14, 6);
    add(-84, 58, 4, 20, 14);
    add(-6, 52, 6, 16, 8, 0.2);
    const legs = merge([place(rbox(0.16, 0.86, 0.18, 0.05), -0.1, 0.43, 0), place(rbox(0.16, 0.86, 0.18, 0.05), 0.1, 0.43, 0), place(rbox(0.38, 0.14, 0.26, 0.04), 0, 0.9, 0)]);
    const vest = merge([place(rbox(0.44, 0.56, 0.26, 0.08), 0, 1.22, 0), place(rbox(0.11, 0.5, 0.11, 0.04), -0.28, 1.2, 0), place(rbox(0.11, 0.5, 0.11, 0.04), 0.28, 1.2, 0)]);
    const headG = merge([place(new THREE.SphereGeometry(0.11, 12, 10), 0, 1.6, 0), place(new THREE.SphereGeometry(0.135, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.65, 0), place(new THREE.CylinderGeometry(0.17, 0.17, 0.015, 14), 0, 1.655, 0.02)]);
    const crewLegs = instanced(legs, paint('#2b3442', 0.8, 0), crew.map(() => new THREE.Matrix4()), { shadow: true });
    const crewVest = instanced(vest, paint('#ff7a1a', 0.55, 0), crew.map(() => new THREE.Matrix4()), { shadow: true });
    const crewHead = instanced(headG, paint('#f7f7f4', 0.35, 0), crew.map(() => new THREE.Matrix4()), { shadow: false });
    g.add(crewLegs, crewVest, crewHead);

    return { g, trucks, crew, crewLegs, crewVest, crewHead, fresh, pipeV };
  }, [M]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3(1, 1, 1), v: new THREE.Vector3() }), []);

  useFrame(() => {
    const b = B;
    b.g.visible = film.scene === 1;
    if (!b.g.visible) return;
    const t = film.t;
    // trucks drive the loop clockwise at site speed
    const L = LOOP, w = L.x1 - L.x0, d = L.z0 - L.z1, per = 2 * (w + d);
    b.trucks.forEach((k) => {
      let s = ((((k.off + t * k.speed) % 1) + 1) % 1) * per;
      let x: number, z: number, ry: number;
      if (s < w) { x = L.x0 + s; z = L.z0 - 2.2; ry = Math.PI / 2; }
      else if ((s -= w) < d) { x = L.x1 - 2.2; z = L.z0 - s; ry = Math.PI; }
      else if ((s -= d) < w) { x = L.x1 - s; z = L.z1 + 2.2; ry = -Math.PI / 2; }
      else { s -= w; x = L.x0 + 2.2; z = L.z1 + s; ry = 0; }
      k.obj.position.set(x, 0, z); k.obj.rotation.y = ry;
    });
    // dock apron pour advances west across the bay during the film
    const len = (APRON.x1 - APRON.x0) * (0.25 + 0.6 * span(t, 0, 19));
    b.fresh.scale.x = len; b.fresh.position.set(APRON.x1 - len / 2, 0.25, (APRON.z0 + APRON.z1) / 2);
    // tower pipeline follows the deck; deck crews ride the active floor
    const F = towerFloors(t, 1), level = Math.min(TOWER.floors, Math.floor(F)), u = F - level;
    const y0 = level * TOWER.floor;
    b.pipeV.scale.y = y0 + TOWER.floor * 0.9;
    void u; void seat;
    b.crew.forEach((c, i) => {
      const wx = c.walk ? Math.sin(t * 0.3 * c.walk + c.ph) * 4 : 0;
      const y = c.deck ? (F >= TOWER.floors ? y0 + 1.2 : y0 + TOWER.floor + 0.05) : 0;   // on the forms / deck level all shot
      const ry = c.walk ? (Math.cos(t * 0.3 * c.walk + c.ph) > 0 ? Math.PI / 2 : -Math.PI / 2) : c.ry + Math.sin(t * 0.5 + c.ph) * 0.3;
      tmp.m.compose(tmp.v.set(c.x + wx, y, c.z), tmp.q.setFromEuler(tmp.e.set(0, ry, 0)), tmp.s);
      b.crewLegs.setMatrixAt(i, tmp.m); b.crewVest.setMatrixAt(i, tmp.m); b.crewHead.setMatrixAt(i, tmp.m);
    });
    b.crewLegs.instanceMatrix.needsUpdate = true; b.crewVest.instanceMatrix.needsUpdate = true; b.crewHead.instanceMatrix.needsUpdate = true;
  });

  return <primitive object={B.g} />;
}
