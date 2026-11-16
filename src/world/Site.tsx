import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { film, span, seat, smooth, clamp01, lerp } from '../film/clock';
import { SITE_ORIGIN, S } from '../film/shots';
import { mats, WAVE } from './materials';
import { rbox, merge, place, instanced, mesh, mat, rod, rand, boxUVWorld } from './geo';
import { palmGeometry } from './Landscape';
import { buildH1 } from './Machine';
import { anchor } from './anchors';

/**
 * The everyday site (Scenes 2 + 3), built in site-local metres: frontage x 0..9, depth z 0..-15, front elevation at z = 0.
 * The group is rotated 180 deg so the front faces the camera arriving from the far side, with the giants' skyline behind.
 */
const GF = 3.1, PL = 0.45, CW = 0.23, CD = 0.45;
const COLS_X = [0.115, 4.5, 8.885], COLS_Y = [-0.225, -5, -10, -14.775];
const EXT: [number, number] = [-4.2, -0.225];          // the extension column (hero of shots 6 + 9)
const Z1 = GF + 0.125;                                  // first-floor slab top
const WAVE_O = new THREE.Vector3(...S(11.0, 1.1, 3.1));   // the wave starts at the builder's tablet

/** a part that travels between a stack and its working position (both local matrices) */
type Swap = { geo: number; on: THREE.Matrix4; off: THREE.Matrix4; t0: number; dur: number; dir: 'in' | 'out'; appear?: number; pin?: Swap; pout?: Swap };

function travel(a: THREE.Matrix4, b: THREE.Matrix4, u: number, lift: number, out: THREE.Matrix4) {
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), sa = new THREE.Vector3(), sb = new THREE.Vector3();
  a.decompose(pa, qa, sa); b.decompose(pb, qb, sb);
  const e = smooth(u);
  const p = pa.clone().lerp(pb, e); p.y += Math.sin(Math.PI * e) * lift;
  const q = qa.clone().slerp(qb, smooth(clamp01((u - 0.1) / 0.8)));
  return out.compose(p, q, sa.lerp(sb, e));
}

function jetPanelGeometry(w: number, h: number) {
  const t = 0.05;
  const parts = [place(rbox(w, h, 0.012, 0.004, 1), 0, h / 2, 0.006)];
  // perimeter ribs + 150 mm grid ribs on the back (the green JET signature)
  parts.push(place(rbox(w, 0.012, t, 0.003, 1), 0, 0.006, t / 2), place(rbox(w, 0.012, t, 0.003, 1), 0, h - 0.006, t / 2));
  parts.push(place(rbox(0.012, h, t, 0.003, 1), -w / 2 + 0.006, h / 2, t / 2), place(rbox(0.012, h, t, 0.003, 1), w / 2 - 0.006, h / 2, t / 2));
  for (let y = 0.15; y < h - 0.05; y += 0.15) parts.push(place(rbox(w - 0.02, 0.006, t * 0.7, 0.002, 1), 0, y, t * 0.35));
  for (let x = -w / 2 + 0.15; x < w / 2 - 0.05; x += 0.15) parts.push(place(rbox(0.006, h - 0.02, t * 0.7, 0.002, 1), x, h / 2, t * 0.35));
  // handle slots / pin holes read as dark notches
  return merge(parts);
}

export function Site() {
  const M = mats();
  const { gl } = useThree();
  gl.localClippingEnabled = true;

  const B = useMemo(() => {
    const root = new THREE.Group();
    root.position.set(...SITE_ORIGIN); root.rotation.y = Math.PI;
    const r = rand(42);
    const add = (o: THREE.Object3D) => { root.add(o); return o; };

    // ---------------- yard, street, plinth + RC frame (ground floor cast, first-floor columns in forms)
    const yard = mesh(new THREE.PlaneGeometry(60, 50).rotateX(-Math.PI / 2), M.earth, false); yard.position.set(4.5, 0.01, -2); yard.receiveShadow = true; add(yard);
    add(mesh(new THREE.BoxGeometry(120, 0.06, 7.5), M.asphalt, false)).position.set(4.5, 0.03, 11.5);
    const frame: THREE.BufferGeometry[] = [place(rbox(9.2, PL, 15.2, 0.015), 4.5, PL / 2, -7.5)];
    for (const x of COLS_X) for (const z of COLS_Y) frame.push(place(rbox(CW, GF - PL, CD, 0.008), x, PL + (GF - PL) / 2, z));
    for (const z of COLS_Y) frame.push(place(rbox(9.0, 0.45, 0.23, 0.008), 4.5, GF - 0.225, z));
    for (const x of COLS_X) frame.push(place(rbox(0.23, 0.45, 15.0, 0.008), x, GF - 0.225, -7.5));
    frame.push(place(rbox(9.23, 0.125, 15.23, 0.008), 4.5, GF + 0.0625, -7.5));
    // footing pedestal + plinth-beam stub for the extension bay
    frame.push(place(rbox(0.9, 0.5, 0.9, 0.01), EXT[0], 0.25, EXT[1]));
    frame.push(place(rbox(4.3, 0.45, 0.23, 0.008), (EXT[0] + 0.115) / 2, PL / 2, EXT[1]));
    add(mesh(boxUVWorld(merge(frame), 0.5), M.concreteSite));

    // ---------------- rebar: first-floor starters, extension column cage (bars + stirrups)
    const bars: THREE.BufferGeometry[] = [];
    for (const x of COLS_X) for (const z of COLS_Y) for (const dx of [-0.07, 0.07]) for (const dz of [-0.17, 0, 0.17])
      bars.push(rod(new THREE.Vector3(x + dx, Z1, z + dz), new THREE.Vector3(x + dx + (r() - 0.5) * 0.04, Z1 + 3.75, z + dz + (r() - 0.5) * 0.04), 0.008, 5));
    for (const dx of [-0.07, 0.07]) for (const dz of [-0.17, 0, 0.17]) bars.push(rod(new THREE.Vector3(EXT[0] + dx, 0.5, EXT[1] + dz), new THREE.Vector3(EXT[0] + dx, 3.6, EXT[1] + dz), 0.008, 6));
    for (let y = 0.6; y < 3.4; y += 0.15) bars.push(place(new THREE.TorusGeometry(0.11, 0.004, 4, 4).rotateX(Math.PI / 2).rotateY(Math.PI / 4).scale(0.75, 1, 1.3), EXT[0], y, EXT[1]));
    add(mesh(merge(bars), M.rebar));

    // ---------------- swappable formwork: plywood (old) <-> JET (new)
    const swaps: Swap[] = [];
    const geos: THREE.BufferGeometry[] = [];
    const geoIdx = new Map<string, number>();
    const g = (key: string, make: () => THREE.BufferGeometry) => { if (!geoIdx.has(key)) { geoIdx.set(key, geos.length); geos.push(make()); } return geoIdx.get(key)!; };
    const plyW = g('plyW', () => boxUVWorld(rbox(CW + 0.04, 2.85, 0.018, 0.003, 1), 0.5)), plyD = g('plyD', () => boxUVWorld(rbox(CD, 2.85, 0.018, 0.003, 1), 0.5));
    const jetW = g('jetW', () => jetPanelGeometry(CW + 0.1, 1.2)), jetD = g('jetD', () => jetPanelGeometry(CD, 1.2));
    const jetWs = g('jetWs', () => jetPanelGeometry(CW + 0.1, 0.45)), jetDs = g('jetDs', () => jetPanelGeometry(CD, 0.45));
    const columns = [{ x: EXT[0], z: EXT[1], y: PL, ext: true }, ...COLS_X.flatMap((x) => COLS_Y.map((z) => ({ x, z, y: Z1, ext: false })))];
    columns.forEach((c, ci) => {
      const wLocal = new THREE.Vector3(...S(c.x, c.y, c.z));
      const d = wLocal.distanceTo(WAVE_O);
      const ts = c.ext ? 38.4 : 38.1 + d / 11 + (ci % 3) * 0.08;
      const faces = [
        { gw: plyW, gj: jetW, gjs: jetWs, x: 0, z: CD / 2 + 0.012, ry: 0 }, { gw: plyW, gj: jetW, gjs: jetWs, x: 0, z: -CD / 2 - 0.012, ry: Math.PI },
        { gw: plyD, gj: jetD, gjs: jetDs, x: CW / 2 + 0.012, z: 0, ry: Math.PI / 2 }, { gw: plyD, gj: jetD, gjs: jetDs, x: -CW / 2 - 0.012, z: 0, ry: -Math.PI / 2 },
      ];
      const stackP = c.ext ? new THREE.Vector3(-6.3, 0.12, -2.0) : new THREE.Vector3(c.x + (c.x > 4 ? -1.2 : 1.2), Z1 + 0.06, c.z + (c.z < -7 ? 1.0 : -1.0));
      const jetStack = c.ext ? new THREE.Vector3(-2.4, 0.16, 2.4) : stackP.clone().add(new THREE.Vector3(0, 0, c.z < -7 ? 0.9 : -0.9));
      faces.forEach((f, fi) => {
        const on = mat(c.x + f.x, c.y + 0.0, c.z + f.z, 0, f.ry, 0);
        const off = mat(stackP.x, stackP.y + fi * 0.02, stackP.z, -Math.PI / 2, 0, 0);
        // shot 6: worker A is still setting the last board on the extension column (23 -> 26.6 s)
        if (c.ext && fi === 0) swaps.push({ geo: f.gw, on, off: mat(c.x + 0.3, 0.02, c.z + 1.1, -1.25, 0.1, 0), t0: 24.6, dur: 2.0, dir: 'in' });
        swaps.push({ geo: f.gw, on, off, t0: ts + fi * 0.12, dur: 0.9, dir: 'out' });
        [[0, f.gj], [1.2, f.gj], [2.4, f.gjs]].forEach(([dy, gg], ri) => {
          const jon = mat(c.x + f.x * 1.15, c.y + (dy as number), c.z + f.z * 1.08, 0, f.ry, 0);
          const joff = mat(jetStack.x, jetStack.y + (fi * 3 + ri) * 0.055, jetStack.z, -Math.PI / 2, 0.2, 0);
          swaps.push({ geo: gg as number, on: jon, off: joff, t0: ts + 0.75 + (fi * 3 + ri) * 0.07, dur: 0.75, dir: 'in' });
        });
      });
    });
    // slab soffit over the front bay: plywood sheets + rusty props -> JET slab panels + galvanised props
    const sheet = g('sheet', () => boxUVWorld(rbox(1.2, 0.018, 2.4, 0.003, 1), 0.5)), jetSlab = g('jetSlab', () => jetPanelGeometry(0.6, 1.2).rotateX(Math.PI / 2));
    const propOld = g('propOld', () => new THREE.CylinderGeometry(0.024, 0.03, 2.75, 7).translate(0, 1.375, 0)), propNew = g('propNew', () => merge([new THREE.CylinderGeometry(0.03, 0.03, 2.72, 10).translate(0, 1.36, 0), place(rbox(0.15, 0.012, 0.15, 0.003), 0, 2.72, 0), place(rbox(0.15, 0.012, 0.15, 0.003), 0, 0.006, 0)]));
    const ys = Z1 + 2.85;
    for (let x = 0.2; x < 8.8; x += 1.21) for (let z = -0.2; z > -4.8; z -= 2.41) {
      const on = mat(x + 0.6, ys, z - 1.2, (r() - 0.5) * 0.01, 0, (r() - 0.5) * 0.01);
      const d = new THREE.Vector3(...S(x, ys, z)).distanceTo(WAVE_O);
      swaps.push({ geo: sheet, on, off: mat(x + 0.6, Z1 + 0.05 + r() * 0.1, z - 1.2 + 0.4, 0, 0.3, 0), t0: 39.0 + d / 12, dur: 0.8, dir: 'out' });
    }
    for (let x = 0.5; x < 8.8; x += 0.6) for (let z = -0.25; z > -4.9; z -= 1.2) {
      const d = new THREE.Vector3(...S(x, ys, z)).distanceTo(WAVE_O);
      swaps.push({ geo: jetSlab, on: mat(x, ys - 0.05, z - 0.6, 0, 0, 0), off: mat(x, Z1 + 0.08, z - 0.6, 0, 0, 0), t0: 39.6 + d / 12 + r() * 0.15, dur: 0.6, dir: 'in' });
    }
    for (let x = 0.9; x < 8.6; x += 1.5) for (let z = -0.8; z > -4.8; z -= 1.3) {
      const d = new THREE.Vector3(...S(x, ys, z)).distanceTo(WAVE_O);
      swaps.push({ geo: propOld, on: mat(x + (r() - 0.5) * 0.15, Z1, z, (r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.04), off: mat(x, Z1 + 0.05, z + 0.5, 0, 0, Math.PI / 2), t0: 39.1 + d / 12, dur: 0.7, dir: 'out' });
      swaps.push({ geo: propNew, on: mat(x, Z1, z), off: mat(x, Z1 + 0.05, z - 0.5, 0, 0, Math.PI / 2), t0: 39.8 + d / 12, dur: 0.6, dir: 'in' });
    }
    // wall forms for the brick bays (46-50 s): JET wall panels box the bay, then strike to reveal the monolithic wall
    const jetWall = g('jetWall', () => jetPanelGeometry(0.6, 1.1));
    const bays = [{ a: 0.23, b: 4.385, t: 46.1, pallet: new THREE.Vector3(1.6, 0.18, 2.6) }, { a: 4.615, b: 8.77, t: 46.9, pallet: new THREE.Vector3(6.8, 0.18, 2.6) }];
    bays.forEach((bay, bi) => {
      let k = 0;
      for (let x = bay.a + 0.3; x < bay.b - 0.05; x += 0.6) for (const y of [PL, PL + 1.1]) {
        const on = mat(Math.min(x, bay.b - 0.3), y, 0.14, 0, 0, 0);
        const off = mat(bay.pallet.x, bay.pallet.y + k * 0.065, bay.pallet.z, -Math.PI / 2, 0.15, 0);
        swaps.push({ geo: jetWall, on, off, t0: bay.t + k * 0.045, dur: 0.55, dir: 'in' });
        swaps.push({ geo: jetWall, on, off, t0: bay.t + 1.9 + k * 0.035, dur: 0.55, dir: 'out' });
        k++;
      }
      void bi;
    });
    const W2 = new THREE.Vector3(...S(4.5, 1.4, 0.3));
    const wpos = new THREE.Vector3();
    for (const s of swaps) {
      s.pin = swaps.find((o) => o !== s && o.dir === 'in' && o.on === s.on && o.t0 < s.t0);
      s.pout = swaps.find((o) => o !== s && o.dir === 'out' && o.on === s.on && o.t0 > s.t0);
      if (s.dir === 'in' && s.t0 > 30) {
        wpos.setFromMatrixPosition(s.off); const w = new THREE.Vector3(...S(wpos.x, wpos.y, wpos.z));
        s.appear = Math.min(s.t0 - 0.05, s.t0 < 45 ? 37 + w.distanceTo(WAVE_O) / 11 : 45.8 + w.distanceTo(W2) / 5.5);
      }
    }
    const matForGeo = (key: string) => key.startsWith('ply') || key === 'sheet' ? M.plywood : key.startsWith('jet') ? M.jet : key === 'propOld' ? M.propRust : M.steelGalv;
    const keys = [...geoIdx.keys()];
    const swapMeshes = geos.map((geo, i) => {
      const list = swaps.filter((s) => s.geo === i);
      const im = instanced(geo, matForGeo(keys[i]), list.map(() => new THREE.Matrix4()));
      root.add(im);
      return { im, list };
    });

    // ---------------- brickwork (running bond, 230 x 110 x 75 + 10 mm joints) and plaster
    const brickGeo = rbox(0.23, 0.075, 0.11, 0.006, 1);
    const bricks: { m: THREE.Matrix4; c: THREE.Color; bay: number; t: number }[] = [];
    const course = 0.085, Lb = 0.24;
    const tops = [Math.floor((GF - 0.45 - PL) / course), Math.floor((GF - 0.45 - PL) / course)];
    [[0.23, 4.385], [4.615, 8.77]].forEach(([a, b], bi) => {
      const rows = bi === 0 ? 19 : tops[1];
      for (let row = 0; row < rows; row++) {
        const off = row % 2 ? Lb / 2 : 0;
        for (let x = a + off + Lb / 2; x + Lb / 2 <= b + 0.005; x += Lb) {
          if (bi === 1 && x > 5.7 && x < 7.7 && row >= 10 && row <= 23) continue;       // window opening
          if (bi === 0 && row >= 14 && x > b - (row - 13) * 0.36) continue;            // stepped racking
          const y = PL + row * course + course / 2;
          // the course being laid in shot 7: these bricks appear one by one (28.6 -> 32.6 s)
          const laying = bi === 0 && row === 18;
          const tone = 0.62 + r() * 0.18;
          bricks.push({ m: mat(x + (r() - 0.5) * 0.004, y, 0.055 + (r() - 0.5) * 0.004, 0, (r() - 0.5) * 0.012, 0), c: new THREE.Color().setRGB(tone, tone * 0.47 + r() * 0.04, tone * 0.33), bay: bi, t: laying ? 28.6 + ((x - a) / (b - a)) * 4 : -1 });
        }
      }
    });
    const brickMesh = instanced(brickGeo, M.brick, bricks.map((bk) => bk.m), { colors: bricks.map((bk) => bk.c) });
    add(brickMesh);
    const mortarA = mesh(merge([place(new THREE.BoxGeometry(4.15, 19 * course, 0.09), 2.31, PL + (19 * course) / 2, 0.055)]), M.mortar);
    const mortarB = mesh(merge([place(new THREE.BoxGeometry(4.15, tops[1] * course, 0.09), 6.69, PL + (tops[1] * course) / 2, 0.055)]), M.mortar);
    add(mortarA); add(mortarB);
    const lintel = mesh(rbox(2.3, 0.15, 0.115, 0.006), M.concreteSite); lintel.position.set(6.7, PL + 24 * course + 0.07, 0.055); add(lintel);
    // plaster on bay B: 15 mm coat progressing left->right (wet edge darker) - the plasterer's progress through Scene 2
    const plaster = mesh(boxUVWorld(new THREE.BoxGeometry(1, tops[1] * course - 0.05, 0.016), 0.6), M.plaster); add(plaster);
    const wet = mesh(new THREE.BoxGeometry(0.35, tops[1] * course - 0.05, 0.018), M.plasterWet); add(wet);
    // the finished monolithic walls (hidden until their forms close)
    const WH = GF - 0.45 - PL, w0 = PL + 10 * course, w1 = PL + 24 * course;
    const monoA = boxUVWorld(place(rbox(4.155, WH, 0.16, 0.004), 2.31, PL + WH / 2, 0.06), 0.6);
    const monoB = boxUVWorld(merge([
      place(rbox(1.085, WH, 0.16, 0.004), 4.615 + 0.5425, PL + WH / 2, 0.06), place(rbox(1.07, WH, 0.16, 0.004), 8.77 - 0.535, PL + WH / 2, 0.06),
      place(rbox(2.0, w0 - PL, 0.16, 0.004), 6.7, PL + (w0 - PL) / 2, 0.06), place(rbox(2.0, PL + WH - w1, 0.16, 0.004), 6.7, w1 + (PL + WH - w1) / 2, 0.06),
    ]), 0.6);
    const mono = [monoA, monoB].map((geo) => { const m = mesh(geo, M.concreteNew); m.visible = false; add(m); return m; });
    const monoWin = mesh(new THREE.BoxGeometry(2.0, w1 - w0, 0.03), M.glass); monoWin.position.set(6.7, (w0 + w1) / 2, 0.06); monoWin.visible = false; add(monoWin);

    // ---------------- site life: mortar tub, cement bags, heaps, drums, wheelbarrow, bamboo scaffold, brick pallet, JET pallets
    add(mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.25, 20), M.tyre)).position.set(1.9, 0.125, 1.0);
    add(mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.03, 20), M.mortar)).position.set(1.9, 0.23, 1.0);
    const bags = instanced(rbox(0.42, 0.13, 0.64, 0.05), M.cementBag, Array.from({ length: 12 }, (_, i) => mat(-2.6 + (i % 3) * 0.44, 0.065 + Math.floor(i / 3) * 0.13, 1.8 + (r() - 0.5) * 0.04, 0, (r() - 0.5) * 0.1, 0)));
    add(bags);
    const heap = (x: number, z: number, rad: number, h: number, m: THREE.Material, seed: number) => {
      const geo = new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2);
      const p = geo.getAttribute('position') as THREE.BufferAttribute; const rr = rand(seed);
      const bump = Array.from({ length: 8 }, () => rr());
      for (let i = 0; i < p.count; i++) {
        const a = Math.atan2(p.getZ(i), p.getX(i));
        const n = 1 + 0.12 * Math.sin(a * 3 + bump[0] * 6) + 0.06 * Math.sin(a * 7 + bump[1] * 6);
        p.setXYZ(i, p.getX(i) * rad * n, Math.pow(Math.max(0, p.getY(i)), 1.5) * h * n, p.getZ(i) * rad * n);
      }
      geo.computeVertexNormals();
      const o = mesh(geo, m); o.position.set(x, 0, z); add(o); return o;
    };
    heap(-6.0, 2.4, 1.5, 0.95, M.sand, 3);
    heap(-10.2, 5.6, 1.4, 0.9, M.aggregate, 4);
    add(instanced(new THREE.CylinderGeometry(0.29, 0.29, 0.88, 28), M.drum, [mat(12.6, 0.44, -1.6), mat(12.7, 0.44, -2.3), mat(13.3, 0.44, -1.9)]));
    const pallet = merge(Array.from({ length: 5 }, (_, k) => place(merge(Array.from({ length: 6 }, (_, i) => place(rbox(0.23, 0.075, 0.11, 0.005, 1), -0.3 + (i % 2) * 0.24 + (k % 2 ? 0.12 : 0), 0.0375 + k * 0.077, -0.25 + Math.floor(i / 2) * 0.12))), 0, 0.12, 0)));
    add(instanced(pallet, M.brick, [mat(-6.4, 0, 2.2, 0, 0.3, 0), mat(-5.6, 0, 2.6, 0, 0.1, 0)], { colors: [new THREE.Color('#b8603f'), new THREE.Color('#ad5a3b')] }));
    // bamboo scaffold on the right flank, lashed with coir
    const bam: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) for (const dx of [9.6, 10.6]) bam.push(rod(new THREE.Vector3(dx, 0, -i * 2.5), new THREE.Vector3(dx + (r() - 0.5) * 0.1, 7.4, -i * 2.5 + (r() - 0.5) * 0.1), 0.042, 7));
    for (let k = 0; k < 5; k++) for (const dx of [9.6, 10.6]) bam.push(rod(new THREE.Vector3(dx, 1.2 + k * 1.45, 0.3), new THREE.Vector3(dx, 1.25 + k * 1.45, -15.3), 0.036, 7));
    add(mesh(merge(bam), M.bamboo));

    // ---------------- H1-561 ECO (provisional) - revealed by a scanning clip plane (local y) at 41.4 s
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
    const h1 = buildH1([clipPlane]);
    h1.group.position.set(-7.2, 0, -4.0); h1.group.rotation.y = Math.PI * 0.62;
    add(h1.group);
    const trace = mesh(new THREE.TorusGeometry(2.05, 0.012, 6, 64).rotateX(Math.PI / 2).scale(1, 1, 0.55), new THREE.MeshBasicMaterial({ color: '#47C13C', toneMapped: false }), false);
    trace.position.copy(h1.group.position); add(trace);
    // delivery hose: machine outlet -> top of the extension column form
    const hoseCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-5.8, 1.05, -3.1), new THREE.Vector3(-5.6, 0.15, -2.1), new THREE.Vector3(-5.2, 0.12, -0.9), new THREE.Vector3(-4.5, 1.8, -0.6), new THREE.Vector3(-4.2, 3.55, -0.23)]);
    const hose = mesh(new THREE.TubeGeometry(hoseCurve, 80, 0.055, 10), M.tyre); add(hose);

    // ---------------- neighbours, street, power lines, palms (keeps the skyline visible behind the site)
    const nb = [[-14, -6, 8, 14, 6.4, 0], [16.5, -6, 7, 14, 9.6, 1], [-14, 22, 10, 9, 6.4, 2], [6, 24, 14, 8, 9.6, 3], [22, 22, 8, 9, 6.4, 1]];
    nb.forEach(([x, z, w, d, h, ci]) => {
      const o = mesh(new THREE.BoxGeometry(w, h, d), M.house[ci]); o.position.set(x, h / 2, z); add(o);
      const rf = mesh(rbox(w + 0.3, 0.16, d + 0.3, 0.02), M.roof); rf.position.set(x, h + 0.08, z); add(rf);
      const tk = mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.25, 16), M.tank); tk.position.set(x + w / 4, h + 0.78, z - d / 4); add(tk);
    });
    const poles = [-14, 6, 26].map((x) => new THREE.Vector3(x, 0, 8.2));
    const lines: THREE.BufferGeometry[] = [];
    poles.forEach((p) => { lines.push(place(new THREE.CylinderGeometry(0.11, 0.15, 9.5, 8), p.x, 4.75, p.z)); lines.push(place(rbox(2.0, 0.1, 0.1, 0.01), p.x, 9.1, p.z)); });
    add(mesh(merge(lines), M.pole));
    const wires: THREE.BufferGeometry[] = [];
    for (let i = 0; i < poles.length - 1; i++) for (const o of [-0.85, -0.3, 0.3, 0.85]) {
      const a = poles[i].clone().add(new THREE.Vector3(o, 9.15, 0)), b = poles[i + 1].clone().add(new THREE.Vector3(o, 9.15, 0));
      const pts = Array.from({ length: 16 }, (_, k) => { const t = k / 15; const p = a.clone().lerp(b, t); p.y -= 0.9 * 4 * t * (1 - t); return p; });
      wires.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 4));
    }
    add(mesh(merge(wires), M.wire, false));
    const palm = palmGeometry();
    const palms: [number, number, number][] = [[-11, 4.5, 11], [13.5, 4, 13], [-9, -18, 12], [18, -16, 14]];
    palms.forEach(([x, z, h]) => {
      add(mesh(new THREE.CylinderGeometry(0.15, 0.2, h, 8).translate(0, h / 2, 0), M.trunk)).position.set(x, 0, z);
      add(mesh(palm, M.frond)).position.set(x, h, z);
    });

    return { root, swapMeshes, bricks, brickMesh, plaster, wet, mono, monoWin, h1, clipPlane, trace, hose, bays, tops };
  }, [M]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), z: new THREE.Matrix4().makeScale(0, 0, 0), w: new THREE.Vector3() }), []);

  useFrame(() => {
    const t = film.t, b = B;
    const near = t > 18.5;
    b.root.visible = near || t < 1;     // the site lives far away; skip it until the descent
    if (!near) return;
    // ---- formwork swaps (deterministic in t)
    for (const { im, list } of b.swapMeshes) {
      list.forEach((s, i) => {
        const u = clamp01((t - s.t0) / s.dur);
        // 'in' parts rest at `off` before, travel, then sit `on`; 'out' parts sit `on` then travel to `off`
        let show = true;
        if (s.dir === 'in') {
          // JET parts are revealed on their pallet as the wave reaches them; a later 'out' twin takes over at strike
          if (s.pout && t > s.pout.t0) show = false;
          else if (s.appear !== undefined && t < s.appear) show = false;
          if (show) travel(s.off, s.on, u, s.t0 < 30 ? 0.5 : 0.65, tmp.m);
        } else {
          if (s.pin && t < s.pin.t0 + s.pin.dur) show = false;                        // its 'in' twin is still placing it
          else if (s.pin && s.pin.t0 > 30 && u >= 1) show = false;                    // struck wall forms return under the pallet stack
          else travel(s.on, s.off, u, 0.45, tmp.m);
        }
        im.setMatrixAt(i, show ? tmp.m : tmp.z);
      });
      im.instanceMatrix.needsUpdate = true;
    }
    // ---- brick course being laid (shot 7), bricks + plaster hidden once a bay is boxed by JET forms
    const covered = b.bays.map((bay) => t > bay.t + 0.9);
    b.bricks.forEach((bk, i) => {
      if (covered[bk.bay]) { b.brickMesh.setMatrixAt(i, tmp.z); return; }
      if (bk.t < 0) { b.brickMesh.setMatrixAt(i, bk.m); return; }
      const u = clamp01((t - bk.t) / 0.35);
      if (u <= 0) { b.brickMesh.setMatrixAt(i, tmp.z); return; }
      tmp.m.copy(bk.m); tmp.m.elements[13] += (1 - seat(u)) * 0.22; tmp.m.elements[14] += (1 - seat(u)) * 0.16;
      b.brickMesh.setMatrixAt(i, tmp.m);
    });
    b.brickMesh.instanceMatrix.needsUpdate = true;
    const pw = lerp(1.2, 2.6, smooth(span(t, 26, 37)));
    const ph = (b.tops[1] * 0.085 - 0.05);
    b.plaster.visible = b.wet.visible = !covered[1];
    b.plaster.scale.x = pw; b.plaster.position.set(4.615 + pw / 2, PL + ph / 2 + 0.02, 0.119);
    b.wet.position.set(4.615 + pw + 0.1, PL + ph / 2 + 0.02, 0.12);
    b.mono.forEach((m, i) => (m.visible = covered[i]));
    b.monoWin.visible = covered[1];
    // ---- H1 machine: scanning reveal, mixing, pumping
    const rv = smooth(span(t, 41.3, 42.9));
    b.trace.visible = t > 41.2 && t < 43.1;
    // clip plane works in world space: the site group is at y = 0, so local y == world y
    b.clipPlane.constant = rv * 3.0;
    b.trace.position.y = rv * 3.0;
    b.trace.scale.setScalar(1);
    b.h1.mixer.rotation.x = t > 42.5 ? (t - 42.5) * 9 : 0;
    b.h1.mix.position.y = 0.66 + 1.45 - 0.12 + Math.sin(t * 7) * 0.01;
    b.hose.visible = t > 43.0;
    b.hose.scale.setScalar(1 + (t > 43.2 ? Math.max(0, Math.sin(t * 6)) * 0.04 : 0));
    // ---- the transformation wave (shared shader uniforms, world space)
    let R = -10, str = 0;
    if (t > 37 && t < 41.5) { R = (t - 37.0) * 11; str = smooth(span(t, 37.0, 37.25)) * (1 - smooth(span(t, 40.2, 41.5))); WAVE.uWaveOrigin.value.copy(WAVE_O); }
    else if (t > 45.8 && t < 48.6) { R = (t - 45.8) * 5.5; str = smooth(span(t, 45.8, 46.0)) * (1 - smooth(span(t, 47.6, 48.6))); WAVE.uWaveOrigin.value.set(...S(4.5, 1.4, 0.3)); }
    WAVE.uWaveR.value = R; WAVE.uWaveStrength.value = str;
    // ---- tracked labels
    anchor('jet', ...S(EXT[0] - 0.4, 2.9, EXT[1]));
    anchor('h1', ...S(-7.2, 2.6, -4.0));
    anchor('builder', ...S(11.2, 1.7, 3.4));
  });

  return <primitive object={B.root} />;
}
