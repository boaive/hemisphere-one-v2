import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { film } from '../../film/clock';
import { rbox, merge, place, instanced, mesh, mat, rand, iSection } from '../geo';
import { mats } from '../materials';
import { H, FL, SIDES, modules, floorGeometry, panelGeometry, PIER, WIN, MOD, SILL, HEAD, SLAB, type Side } from '../Tower';
import { MW, MH, MD, PODIUM, moduleGeometry, claddingGeometry } from '../Precast';
import { paint, truckGeo, WHEELS } from './Campus';

type Mats = ReturnType<typeof mats>;

/**
 * The rest of Film 01's controlled environment: the township growing round the three hero systems.
 * More Aluform towers at different stages (each with its tower crane), a finished precast block and one at
 * podium level, the on-site precast casting yard under a travelling gantry, a second panelized hall, an
 * excavation, the labour colony and the truck marshalling yard. Static stages with live motion (cranes slewing,
 * the gantry travelling, crews at work), all on film time.
 */
const TOWERS2 = [
  { x: -2, z: -112, n: 15, topped: false, cx: -1, mast: 64, jib: 46 },
  { x: 52, z: -118, n: 22, topped: true, cx: 1, mast: 86, jib: 50 },
  { x: 104, z: -112, n: 8, topped: false, cx: 1, mast: 44, jib: 40 },
];
const P2 = { x: -128, z: -56, levels: 8 }, P3 = { x: -128, z: -4, levels: 2 };
const HALL = { x: 150, z: -24, w: 60, d: 40, h: 12.4, low: 5.6 };
const YARD = { x0: -182, x1: -92, zA: -160, zB: -110 };
const PIT = { x0: -92, x1: -62, z0: -86, z1: -106 };

type Kit = { side: Side; s: number; y: number };
const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, recv = false) => { o.position.set(x, y, z); if (recv) o.receiveShadow = true; return o; };

function towerCrane(M: Mats, h: number, jib: number) {
  const crane = new THREE.Group();
  const mast = mesh(new THREE.BoxGeometry(2, h, 2), M.lattice, false); mast.position.y = h / 2; crane.add(mast);
  const spine = mesh(new THREE.BoxGeometry(0.8, h, 0.8), M.steelYellowCrane); spine.position.y = h / 2; crane.add(spine);
  const base = mesh(rbox(5, 1.2, 5, 0.05), M.concrete); base.position.y = 0.6; crane.add(base);
  const slew = new THREE.Group(); slew.position.y = h; crane.add(slew);
  const j = mesh(new THREE.BoxGeometry(jib, 1.6, 1.4), M.lattice, false); j.position.set(-jib / 2 + 3, 1, 0); slew.add(j);
  const chord = mesh(new THREE.BoxGeometry(jib + 15, 0.4, 0.7), M.steelYellowCrane); chord.position.set(-jib / 2 + 3 + 7.5, 1.6, 0); slew.add(chord);
  const cj = mesh(new THREE.BoxGeometry(15, 1.4, 1.4), M.lattice, false); cj.position.set(8.5, 1, 0); slew.add(cj);
  const cw = mesh(rbox(3, 2.6, 2.2, 0.05), M.concrete); cw.position.set(14, -0.6, 0); slew.add(cw);
  const cab = mesh(rbox(2.2, 2.4, 2.2, 0.08), M.cladding); cab.position.set(0, -1.4, 1.8); slew.add(cab);
  const apex = mesh(new THREE.BoxGeometry(1.3, 9, 1.3), M.lattice, false); apex.position.y = 5.5; slew.add(apex);
  const tr = -jib * 0.55, drop = h * 0.42;
  const trolley = mesh(rbox(1.6, 0.6, 1.6, 0.05), M.steelYellowCrane); trolley.position.set(tr, 0, 0); slew.add(trolley);
  const line = mesh(new THREE.CylinderGeometry(0.025, 0.025, drop, 5), M.wire, false); line.position.set(tr, -drop / 2, 0); slew.add(line);
  const hook = mesh(rbox(0.5, 0.8, 0.5, 0.06), M.steelYellowCrane); hook.position.set(tr, -drop - 0.4, 0); slew.add(hook);
  return { crane, slew };
}

function kitList() {
  const tall: Kit[] = [], sill: Kit[] = [], lint: Kit[] = [];
  for (const sd of SIDES) {
    let last = -H;
    const run = (a: number, b: number, list: Kit[], y: number) => { for (let s = a; s + 0.6 <= b + 0.001; s += 0.6) list.push({ side: sd, s: s + 0.3, y }); };
    for (const s of modules()) { run(last, s + PIER, tall, 0); run(s + PIER, s + MOD, sill, 0); run(s + PIER, s + MOD, lint, HEAD); last = s + MOD; }
    run(last, H - 0.4, tall, 0);
  }
  return { tall, sill, lint };
}

/** mobile crane (carrier + slewing upper + raised boom) with a load line; local +z is the carrier's front */
function mobileCrane(M: Mats, boomLen: number, boomAng: number, hookY = 4) {
  const o = new THREE.Group();
  o.add(mesh(merge([place(rbox(2.6, 1.4, 11, 0.08), 0, 1.4, 0), place(rbox(2.5, 1.7, 2.3, 0.15), 0, 2.5, 4.8)]), M.steelYellowCrane));
  o.add(instanced(new THREE.CylinderGeometry(0.6, 0.6, 0.5, 18).rotateZ(Math.PI / 2), M.tyre, [-4, -2.2, 2.4, 4.4].flatMap((z) => [mat(-1.35, 0.6, z), mat(1.35, 0.6, z)])));
  const up = new THREE.Group(); up.position.set(0, 2.6, -2); o.add(up);
  up.add(mesh(rbox(2.6, 1.7, 4.2, 0.1), M.steelYellowCrane));
  const boom = mesh(new THREE.BoxGeometry(0.7, 0.7, boomLen).translate(0, 0, boomLen / 2), M.steelYellowCrane); boom.position.set(0, 0.8, 1.6); boom.rotation.x = -boomAng; up.add(boom);
  const tipZ = 1.6 + Math.cos(boomAng) * boomLen, tipY = 0.8 + Math.sin(boomAng) * boomLen;
  const hy = hookY - 2.6, len = Math.max(0.5, tipY - hy);
  const ln = mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 6), M.wire, false); ln.position.set(0, tipY - len / 2, tipZ); up.add(ln);
  return { o, up, reach: 2 - 1.6 - Math.cos(boomAng) * boomLen };
}

export function Township() {
  const M = mats();
  const B = useMemo(() => {
    const g = new THREE.Group();
    const r = rand(29);
    const slews: { s: THREE.Group; base: number; ph: number; amp: number }[] = [];

    // ---------------------------------------------------------------- shared tower parts
    const floorG = floorGeometry();
    const paneG = new THREE.BoxGeometry(WIN - 0.06, HEAD - SILL - 0.06, 0.04);
    const finG = rbox(0.12, FL - 0.02, 0.36, 0.02, 2), finM = new THREE.MeshStandardMaterial({ color: '#f2f1ed', roughness: 0.5, metalness: 0.1 });
    const bandG = rbox(2 * H + 0.2, 0.34, 0.1, 0.02, 2), graphite = new THREE.MeshStandardMaterial({ color: '#4a525a', roughness: 0.35, metalness: 0.6 });
    const interiorM = new THREE.MeshStandardMaterial({ color: '#59606a', roughness: 1 });
    const crownG = merge([
      place(rbox(2 * H + 0.3, 1.1, 0.3, 0.02), 0, 0.55, H), place(rbox(2 * H + 0.3, 1.1, 0.3, 0.02), 0, 0.55, -H),
      place(rbox(0.3, 1.1, 2 * H, 0.02), H, 0.55, 0), place(rbox(0.3, 1.1, 2 * H, 0.02), -H, 0.55, 0),
      place(rbox(9, 3.6, 7, 0.05), 0, 1.8, 0), place(rbox(5, 2.2, 4, 0.04), 6.5, 1.1, -5),
    ]);
    const kit = kitList();
    const pTall = panelGeometry(0.6, FL - SLAB), pSill = panelGeometry(0.6, SILL), pLint = panelGeometry(0.6, FL - SLAB - HEAD);
    const screenM = new THREE.MeshStandardMaterial({ color: '#9aa2aa', roughness: 0.6, metalness: 0.4, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    const screenG = merge([place(new THREE.PlaneGeometry(2 * H + 2, 7.4), 0, 0, -H - 1.2), place(new THREE.PlaneGeometry(2 * H + 2, 7.4), -H - 1.2, 0, 0, 0, Math.PI / 2, 0)]);

    // ---------------------------------------------------------------- more Aluform towers (same typology, staggered stages)
    const deckCrew: { x: number; y: number; z: number }[] = [];
    TOWERS2.forEach((T, ti) => {
      const t = new THREE.Group(); t.position.set(T.x, 0, T.z);
      const glazed = T.topped ? T.n : Math.max(0, T.n - 5);
      const fm = Array.from({ length: T.n }, (_, i) => mat(0, i * FL, 0));
      t.add(instanced(floorG, M.concreteTower, fm, { colors: fm.map((_, i) => new THREE.Color().setScalar(i < glazed ? 1.04 : 0.88)) }));
      const panes: THREE.Matrix4[] = [], fins: THREE.Matrix4[] = [], bands: THREE.Matrix4[] = [];
      for (let i = 0; i < glazed; i++) for (const sd of SIDES) {
        for (const s of modules()) {
          const c = sd.at(s + PIER + WIN / 2, i * FL + SLAB + (SILL + HEAD) / 2, -0.12); panes.push(mat(c.x, c.y, c.z, 0, sd.ry, 0));
          const f = sd.at(s + PIER / 2, i * FL + FL / 2, 0.2); fins.push(mat(f.x, f.y, f.z, 0, sd.ry, 0));
        }
        const b = sd.at(0, i * FL + 0.1, 0.05); bands.push(mat(b.x, b.y, b.z, 0, sd.ry, 0));
      }
      if (panes.length) t.add(instanced(paneG, M.glassDistrict, panes, { shadow: false }), instanced(finG, finM, fins), instanced(bandG, graphite, bands, { shadow: false }));
      const podium = mesh(rbox(2 * H + 6, 6.2, 2 * H + 6, 0.08), M.cladding); podium.position.y = 3.1; t.add(podium);
      const canopy = mesh(rbox(2 * H + 9, 0.35, 4, 0.05), graphite); canopy.position.set(0, 6.4, H + 4.5); t.add(canopy);
      const ih = T.n * FL - 0.4;
      const inner = mesh(new THREE.BoxGeometry(2 * H - 0.6, ih, 2 * H - 0.6), interiorM, false); inner.position.y = ih / 2; t.add(inner);
      if (T.topped) { const crown = mesh(crownG, M.cladding); crown.position.y = T.n * FL; t.add(crown); }
      else {
        const y0 = T.n * FL;
        const seat = (list: Kit[]) => list.map((p) => { const v = p.side.at(p.s, y0 + SLAB + p.y, 0); return mat(v.x, v.y, v.z, 0, p.side.ry, 0); });
        t.add(instanced(pTall, M.aluminium, seat(kit.tall)), instanced(pSill, M.aluminium, seat(kit.sill)), instanced(pLint, M.aluminium, seat(kit.lint)));
        const deck = mesh(rbox(2 * H - 0.3, 0.07, 2 * H - 0.3, 0.01), M.deckAlu); deck.position.y = y0 + FL - 0.035; t.add(deck);
        const scr = mesh(screenG, screenM, false); scr.position.y = y0 + 1.6; t.add(scr);
        for (let k = 0; k < 6; k++) deckCrew.push({ x: T.x + (r() - 0.5) * (2 * H - 5), y: y0 + FL + 0.05, z: T.z + (r() - 0.5) * (2 * H - 5) });
      }
      g.add(t);
      // its tower crane on the far corner
      const tc = towerCrane(M, T.mast, T.jib);
      tc.crane.position.set(T.x + T.cx * (H + 6.5), 0, T.z - (H + 6.5));
      g.add(tc.crane); slews.push({ s: tc.slew, base: T.cx > 0 ? -0.6 : 0.9 + ti, ph: ti * 1.7, amp: 0.45 });
      // apron
      const ap = mesh(new THREE.BoxGeometry(2 * H + 18, 0.08, 2 * H + 18), paint('#dcd9d3', 0.88, 0), false); ap.position.set(T.x, 0.04, T.z); ap.receiveShadow = true; g.add(ap);
    });

    // ---------------------------------------------------------------- precast blocks: one finished, one at podium + two levels
    const moduleG = moduleGeometry(), cladG = claddingGeometry(), glassG = new THREE.BoxGeometry(1.7, 1.35, 0.03);
    const facadeM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.62, metalness: 0.05 });
    const pal = ['#ecebe6', '#3b4147', '#ecebe6', '#ecebe6', '#b98a5e', '#ecebe6'].map((c) => new THREE.Color(c));
    const block = (cx: number, cz: number, levels: number, cols = 6, rows = 2) => {
      const X0 = cx - (cols * MW) / 2 + MW / 2;
      const slots: { x: number; y: number; z: number; front: boolean; col: number }[] = [];
      for (let j = 0; j < levels; j++) for (let rr = 0; rr < rows; rr++) for (let i = 0; i < cols; i++) slots.push({ x: X0 + i * MW, y: PODIUM + j * MH, z: rr === 0 ? cz + MD / 2 : cz - MD / 2, front: rr === 0, col: i });
      g.add(instanced(moduleG, M.precast, slots.map((s) => mat(s.x, s.y, s.z, 0, s.front ? 0 : Math.PI, 0))));
      g.add(instanced(cladG, facadeM, slots.map((s) => mat(s.x, s.y, s.z + (s.front ? MD / 2 + 0.035 : -MD / 2 - 0.035), 0, s.front ? 0 : Math.PI, 0)), { shadow: false, colors: slots.map((s) => pal[s.col % pal.length]) }));
      g.add(instanced(glassG, M.glassDistrict, slots.map((s) => mat(s.x, s.y + 1.7, s.z + (s.front ? MD / 2 - 0.05 : -MD / 2 + 0.05))), { shadow: false }));
      const pod = mesh(merge([
        place(rbox(cols * MW + 1, 0.4, rows * MD + 1, 0.02), 0, PODIUM - 0.2, 0),
        ...[-1, 1].flatMap((sz) => Array.from({ length: 4 }, (_, i) => place(rbox(0.6, PODIUM - 0.4, 0.6, 0.02), -cols * MW / 2 + 0.3 + i * (cols * MW - 0.6) / 3, (PODIUM - 0.4) / 2, sz * (MD - 0.3)))),
      ]), M.concrete); pod.position.set(cx, 0, cz); g.add(pod);
      const shop = mesh(new THREE.BoxGeometry(cols * MW - 0.4, PODIUM - 0.6, rows * MD - 0.6), M.glassReal); shop.position.set(cx, (PODIUM - 0.4) / 2, cz); g.add(shop);
      const coreH = PODIUM + Math.max(levels, 1) * MH + 1.2;
      const core = mesh(rbox(5.2, coreH, 7.2, 0.04), M.concrete); core.position.set(cx - cols * MW / 2 - 2.6, coreH / 2, cz); g.add(core);
      const ap = mesh(new THREE.BoxGeometry(cols * MW + 14, 0.08, rows * MD + 14), paint('#dcd9d3', 0.88, 0), false); ap.position.set(cx - 2, 0.04, cz); ap.receiveShadow = true; g.add(ap);
    };
    block(P2.x, P2.z, P2.levels);
    block(P3.x, P3.z, P3.levels);
    // P3's next module, flying on a mobile crane
    const flyY = PODIUM + 2 * MH + 5.5;
    const mc3 = mobileCrane(M, 30, 0.95, flyY + MH); mc3.o.position.set(P3.x + 18, 0, P3.z + 4); mc3.o.rotation.y = -Math.PI / 2; g.add(mc3.o);
    const fly3 = mesh(moduleG, M.precast); fly3.position.set(P3.x + 18 + mc3.reach, flyY, P3.z + 4); g.add(fly3);

    // ---------------------------------------------------------------- precast casting yard: moulds in rows under a travelling gantry
    const mouldM = paint('#5a636c', 0.5, 0.55);
    const mouldG = merge([
      place(rbox(4.8, 0.2, 10.4, 0.02), 0, 0.1, 0),
      place(rbox(0.15, 3.6, 10.4, 0.01), -2.35, 1.8, 0), place(rbox(0.15, 3.6, 10.4, 0.01), 2.35, 1.8, 0),
      place(rbox(4.8, 3.6, 0.15, 0.01), 0, 1.8, -5.15), place(rbox(4.8, 3.6, 0.15, 0.01), 0, 1.8, 5.15),
    ]);
    const cageParts: THREE.BufferGeometry[] = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cageParts.push(place(new THREE.BoxGeometry(0.05, 3.3, 0.05), sx * 1.75, 1.85, sz * 4.45));
    for (const y of [0.3, 1.3, 2.3, 3.4]) { cageParts.push(place(new THREE.BoxGeometry(3.5, 0.03, 0.03), 0, y, 4.45), place(new THREE.BoxGeometry(3.5, 0.03, 0.03), 0, y, -4.45), place(new THREE.BoxGeometry(0.03, 0.03, 8.9), 1.75, y, 0), place(new THREE.BoxGeometry(0.03, 0.03, 8.9), -1.75, y, 0)); }
    for (let k = 0; k < 22; k++) { const zz = -4.3 + k * 0.41; cageParts.push(place(new THREE.BoxGeometry(0.025, 3.3, 0.025), 1.75, 1.85, zz), place(new THREE.BoxGeometry(0.025, 3.3, 0.025), -1.75, 1.85, zz)); }
    const cageG = merge(cageParts);
    const moulds: THREE.Matrix4[] = [], cages: THREE.Matrix4[] = [], cast: THREE.Matrix4[] = [];
    for (let i = 0; i < 10; i++) for (let j = 0; j < 3; j++) {
      const x = YARD.x0 + 4 + i * 9.2, z = YARD.zA + 11 + j * 14, st = (i * 7 + j * 3) % 5;
      moulds.push(mat(x, 0, z));
      if (st === 1 || st === 4) cages.push(mat(x, 0.2, z));
      else if (st === 2 || st === 3) cast.push(mat(x, 0.25, z));
    }
    g.add(instanced(mouldG, mouldM, moulds), instanced(cageG, M.rebar, cages, { shadow: false }), instanced(moduleG, M.precast, cast));
    // finished modules waiting for dispatch at the east end
    const ready: THREE.Matrix4[] = [];
    for (let i = 0; i < 3; i++) for (let lv = 0; lv < 2; lv++) ready.push(mat(YARD.x1 + 10 + i * 4.6, 0.3 + lv * 3.5, (YARD.zA + YARD.zB) / 2));
    g.add(instanced(moduleG, M.precast, ready));
    // rails + gantry (yellow), trolley, spreader and the module on the hook
    g.add(mesh(merge([place(rbox(YARD.x1 - YARD.x0 + 12, 0.3, 0.5, 0.02), (YARD.x0 + YARD.x1) / 2, 0.15, YARD.zA), place(rbox(YARD.x1 - YARD.x0 + 12, 0.3, 0.5, 0.02), (YARD.x0 + YARD.x1) / 2, 0.15, YARD.zB)]), paint('#3d4349', 0.5, 0.6)));
    const gantry = new THREE.Group();
    const GH = 16, span = YARD.zB - YARD.zA, gz = (YARD.zA + YARD.zB) / 2;
    const gParts: THREE.BufferGeometry[] = [];
    for (const z of [YARD.zA, YARD.zB]) {
      gParts.push(place(rbox(0.8, GH, 0.8, 0.04), -3.6, GH / 2, z), place(rbox(0.8, GH, 0.8, 0.04), 3.6, GH / 2, z));
      gParts.push(place(rbox(9, 0.9, 1.0, 0.04), 0, 0.8, z), place(rbox(9, 1.1, 1.1, 0.04), 0, GH, z));
      gParts.push(place(new THREE.BoxGeometry(0.25, 0.25, 9.4).rotateX(0).rotateZ(0), 0, GH * 0.5, z));
    }
    gParts.push(place(rbox(1.3, 2.0, span + 2, 0.04), -1.5, GH + 1.4, gz), place(rbox(1.3, 2.0, span + 2, 0.04), 1.5, GH + 1.4, gz));
    gantry.add(mesh(merge(gParts), M.steelYellowCrane));
    const trolley = new THREE.Group(); gantry.add(trolley);
    trolley.add(at(mesh(rbox(4.6, 1.6, 3.8, 0.06), M.steelYellowCrane), 0, GH + 3.2, 0));
    const hookY = 9.2;
    trolley.add((mesh(merge([-1.4, 1.4].flatMap((x) => [-3, 3].map((z) => place(new THREE.CylinderGeometry(0.03, 0.03, GH + 2.4 - hookY, 5), x * 0.6, (GH + 2.4 + hookY) / 2, z * 0.4)))), M.wire, false)));
    trolley.add(at(mesh(rbox(3.6, 0.35, 9.2, 0.03), paint('#3d4349', 0.5, 0.6)), 0, hookY, 0));
    const hung = mesh(moduleG, M.precast); hung.position.set(0, hookY - 0.4 - MH, 0); trolley.add(hung);
    g.add(gantry);
    // yard apron
    const ya = mesh(new THREE.BoxGeometry(YARD.x1 - YARD.x0 + 30, 0.08, YARD.zB - YARD.zA + 8), paint('#d3d0c9', 0.9, 0), false);
    ya.position.set((YARD.x0 + YARD.x1) / 2 + 8, 0.04, gz); ya.receiveShadow = true; g.add(ya);

    // ---------------------------------------------------------------- second panelized hall: frame up, walls ~60 % clad, roof deck going on
    {
      const h = new THREE.Group(); h.position.set(HALL.x, 0, HALL.z);
      const { w: W, d: D, h: HH, low: LOW } = HALL;
      const steel = paint('#4d5560', 0.45, 0.6);
      h.add(at(mesh(rbox(W + 4, 0.4, D + 4, 0.05), M.concreteReal), 0, 0.2, 0));
      const col = iSection(HH - 0.4, 0.4, 0.3), cols: THREE.Matrix4[] = [];
      for (let x = -W / 2; x <= W / 2 + 0.01; x += 7.5) for (const z of [-D / 2, D / 2]) cols.push(mat(x, 0.4 + (HH - 0.4) / 2, z));
      for (let z = -D / 2 + 10; z < D / 2 - 1; z += 10) for (const x of [-W / 2, W / 2]) cols.push(mat(x, 0.4 + (HH - 0.4) / 2, z));
      for (let x = -W / 2 + 15; x < W / 2 - 1; x += 15) for (let z = -D / 2 + 10; z < D / 2 - 1; z += 10) cols.push(mat(x, 0.4 + (HH - 0.4) / 2, z));
      h.add(instanced(col, steel, cols));
      const beams: THREE.BufferGeometry[] = [];
      for (const y of [LOW, HH - 0.35]) beams.push(place(rbox(W, 0.5, 0.3, 0.02), 0, y, -D / 2), place(rbox(W, 0.5, 0.3, 0.02), 0, y, D / 2), place(rbox(0.3, 0.5, D, 0.02), -W / 2, y, 0), place(rbox(0.3, 0.5, D, 0.02), W / 2, y, 0));
      for (let x = -W / 2 + 7.5; x < W / 2; x += 7.5) beams.push(place(rbox(0.25, 0.6, D, 0.02), x, HH - 0.4, 0));
      h.add(mesh(merge(beams), steel));
      h.add(at(mesh(rbox(W * 0.62, 0.25, D, 0.02), paint('#5b6066', 0.8, 0.2)), -W / 2 + W * 0.31, HH - 0.15, 0));
      const lowP: THREE.Matrix4[] = [], upP: THREE.Matrix4[] = [];
      const wall = (len: number, frac: number, at: (s: number) => [number, number, number]) => {
        const n = Math.floor(len / 1.2);
        for (let i = 0; i < Math.floor(n * frac); i++) {
          const s = -len / 2 + 0.6 + i * 1.2, [x, z, ry] = at(s);
          lowP.push(mat(x, 0.4 + LOW / 2, z, 0, ry, 0, 1, 1, 1));
          if (i < Math.floor(n * frac) - 3) upP.push(mat(x, 0.4 + LOW + (HH - LOW) / 2 - 0.2, z, 0, ry, 0, 1, (HH - LOW - 0.4) / LOW, 1));
        }
      };
      wall(W, 1, (s) => [s, D / 2 + 0.16, 0]);
      wall(D, 1, (s) => [-W / 2 - 0.16, -s, -Math.PI / 2]);
      wall(D, 0.45, (s) => [W / 2 + 0.16, -s, Math.PI / 2]);
      const pG = rbox(1.18, LOW, 0.2, 0.01, 1);
      h.add(instanced(pG, paint('#2f343a', 0.42, 0.35), lowP), instanced(pG, paint('#d4d7da', 0.4, 0.3), upP));
      const mc = mobileCrane(M, 24, 0.9, 7.2 + LOW / 2); mc.o.position.set(W / 2 + 16, 0, 2); mc.o.rotation.y = -Math.PI / 2; h.add(mc.o);
      const flyP = mesh(pG, paint('#2f343a', 0.42, 0.35)); flyP.position.set(W / 2 + 16 + mc.reach, 7.2, 2); flyP.rotation.y = Math.PI / 2; h.add(flyP);
      const bundles: THREE.Matrix4[] = [];
      for (let i = 0; i < 4; i++) bundles.push(mat(-W / 2 + 8 + i * 4, 0.7, D / 2 + 9));
      h.add(instanced(rbox(2.6, 1.3, 7.2, 0.03), paint('#c7cbcf', 0.5, 0.3), bundles));
      g.add(h);
    }

    // ---------------------------------------------------------------- excavation for the next phase: cut, benches, spoil, tipper
    {
      const cutW = PIT.x1 - PIT.x0, cutD = PIT.z0 - PIT.z1, pcx = (PIT.x0 + PIT.x1) / 2, pcz = (PIT.z0 + PIT.z1) / 2;
      g.add(at(mesh(new THREE.BoxGeometry(cutW, 0.06, cutD), paint('#9d8f7a', 1, 0), false), pcx, 0.03, pcz, true));
      g.add(at(mesh(new THREE.BoxGeometry(cutW - 8, 0.07, cutD - 8), paint('#8a7c68', 1, 0), false), pcx, 0.05, pcz, true));
      const spoil = mesh(new THREE.ConeGeometry(7, 3.6, 28), paint('#a8977f', 1, 0)); spoil.position.set(PIT.x1 + 12, 1.8, pcz); spoil.scale.z = 0.7; g.add(spoil);
      const tip = new THREE.Group(); const tg = truckGeo('flatbed');
      tip.add(mesh(tg.cab, paint('#f3f3f1', 0.3, 0.35)), mesh(tg.glass, M.glassReal, false), mesh(tg.chassis, paint('#3b4146', 0.6, 0.4)));
      tip.add(at(mesh(rbox(2.5, 1.5, 5.6, 0.05), M.steelYellowCrane), 0, 2.1, -1.6));
      tip.add(instanced(new THREE.CylinderGeometry(0.52, 0.52, 2.5, 18).rotateZ(Math.PI / 2), M.tyre, WHEELS.map((z) => mat(0, 0.52, z))));
      tip.position.set(PIT.x1 + 4, 0, PIT.z1 + 6); tip.rotation.y = 0.4; g.add(tip);
    }

    // ---------------------------------------------------------------- labour colony (north-east): cabin rows, blue roofs, water tanks, canteen
    {
      const cab: THREE.Matrix4[] = [], roof: THREE.Matrix4[] = [];
      for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++) {
        const x = 146 + i * 8, z = -154 + j * 11;
        cab.push(mat(x, 1.35, z)); roof.push(mat(x, 2.78, z, 0.06, 0, 0));
      }
      g.add(instanced(rbox(6.6, 2.7, 3.2, 0.04), paint('#efeeea', 0.6, 0.05), cab), instanced(rbox(7.0, 0.12, 3.8, 0.02), paint('#3f6fa3', 0.5, 0.3), roof));
      const stand = mesh(merge([place(rbox(4.2, 0.3, 4.2, 0.02), 0, 6, 0), ...[-1.8, 1.8].flatMap((x) => [-1.8, 1.8].map((z) => place(rbox(0.2, 6, 0.2, 0.01), x, 3, z)))]), paint('#5b636a', 0.5, 0.5));
      stand.position.set(138, 0, -116); g.add(stand);
      g.add(instanced(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 18), paint('#1d1f21', 0.5, 0.1), [mat(137, 7, -117), mat(139, 7, -115), mat(137, 7, -115)]));
      const canteen = mesh(merge([place(rbox(18, 0.2, 9, 0.02), 0, 3.4, 0), ...[-8.5, 8.5].flatMap((x) => [-4, 4].map((z) => place(rbox(0.2, 3.4, 0.2, 0.01), x, 1.7, z)))]), paint('#d9dcde', 0.45, 0.5));
      canteen.position.set(176, 0, -100); g.add(canteen);
    }

    // ---------------------------------------------------------------- truck marshalling yard (south-east)
    {
      g.add(at(mesh(new THREE.BoxGeometry(84, 0.08, 24), paint('#d3d0c9', 0.9, 0), false), 160, 0.04, 68, true));
      const mixer = truckGeo('mixer'), flat = truckGeo('flatbed');
      const cabW = paint('#f3f3f1', 0.3, 0.35), chas = paint('#3b4146', 0.6, 0.4), drum = paint('#e9e9e6', 0.35, 0.3), band = paint('#fcd301', 0.4, 0.1);
      for (let i = 0; i < 8; i++) {
        const isMix = i % 3 !== 1;
        const o = new THREE.Group(), G = isMix ? mixer : flat;
        o.add(mesh(G.cab, cabW), mesh(G.glass, M.glassReal, false), mesh(G.chassis, chas), mesh(G.body, isMix ? drum : chas));
        if (isMix) { const b = mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.35, 28).rotateX(Math.PI / 2 - 0.2), band, false); b.position.set(0, 2.62, -1.0); o.add(b); }
        else o.add(at(mesh(rbox(2.4, 1.2, 7.0, 0.03), paint('#c7cbcf', 0.5, 0.3)), 0, 2.1, -1.0));
        o.add(instanced(new THREE.CylinderGeometry(0.52, 0.52, 2.5, 18).rotateZ(Math.PI / 2), M.tyre, WHEELS.map((z) => mat(0, 0.52, z))));
        o.position.set(126 + i * 9.4, 0, 68); o.rotation.y = Math.PI;
        g.add(o);
      }
    }

    // ---------------------------------------------------------------- crews for all of the above
    type W = { x: number; y: number; z: number; ph: number; walk: number; ry: number };
    const crew: W[] = deckCrew.map((d) => ({ ...d, ph: r() * 6.28, walk: 0, ry: r() * 6.28 }));
    const add = (x: number, z: number, n: number, sx: number, sz: number, walk = 0.3, y = 0) => { for (let i = 0; i < n; i++) crew.push({ x: x + (r() - 0.5) * sx, y, z: z + (r() - 0.5) * sz, ph: r() * 6.28, walk: r() < walk ? 0.5 + r() : 0, ry: r() * 6.28 }); };
    add((YARD.x0 + YARD.x1) / 2, (YARD.zA + YARD.zB) / 2, 16, YARD.x1 - YARD.x0, 40, 0.3);
    add(P3.x, P3.z, 6, 18, 14, 0.1, PODIUM + 2 * MH);
    add(P3.x + 14, P3.z + 4, 4, 6, 10, 0.2);
    add(P2.x, P2.z + 14, 4, 20, 4, 0.5);
    add(HALL.x, HALL.z + HALL.d / 2 + 6, 8, HALL.w - 6, 6, 0.3);
    add(HALL.x + HALL.w / 2 + 8, HALL.z, 3, 4, 8, 0.1);
    add((PIT.x0 + PIT.x1) / 2, (PIT.z0 + PIT.z1) / 2, 5, 24, 18, 0.2);
    add(170, -130, 10, 50, 50, 0.7);
    add(160, 60, 6, 70, 6, 0.6);
    for (const T of TOWERS2) add(T.x + 16, T.z + 14, 4, 10, 8, 0.4);
    const legs = merge([place(rbox(0.16, 0.86, 0.18, 0.05), -0.1, 0.43, 0), place(rbox(0.16, 0.86, 0.18, 0.05), 0.1, 0.43, 0), place(rbox(0.38, 0.14, 0.26, 0.04), 0, 0.9, 0)]);
    const vest = merge([place(rbox(0.44, 0.56, 0.26, 0.08), 0, 1.22, 0), place(rbox(0.11, 0.5, 0.11, 0.04), -0.28, 1.2, 0), place(rbox(0.11, 0.5, 0.11, 0.04), 0.28, 1.2, 0)]);
    const headG = merge([place(new THREE.SphereGeometry(0.11, 12, 10), 0, 1.6, 0), place(new THREE.SphereGeometry(0.135, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.65, 0), place(new THREE.CylinderGeometry(0.17, 0.17, 0.015, 14), 0, 1.655, 0.02)]);
    const cL = instanced(legs, paint('#2b3442', 0.8, 0), crew.map(() => new THREE.Matrix4()));
    const cV = instanced(vest, paint('#ff7a1a', 0.55, 0), crew.map(() => new THREE.Matrix4()));
    const cH = instanced(headG, paint('#f7f7f4', 0.35, 0), crew.map(() => new THREE.Matrix4()), { shadow: false });
    g.add(cL, cV, cH);

    return { g, slews, gantry, trolley, crew, cL, cV, cH };
  }, [M]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3(1, 1, 1), v: new THREE.Vector3() }), []);

  useFrame(() => {
    const b = B;
    b.g.visible = film.scene === 1;
    if (!b.g.visible) return;
    const t = film.t;
    b.slews.forEach((c) => { c.s.rotation.y = c.base + Math.sin(t * 0.32 + c.ph) * c.amp; });
    // gantry travels the yard and the trolley shuttles across the span (eased, deterministic)
    b.gantry.position.x = YARD.x0 + 14 + (YARD.x1 - YARD.x0 - 28) * (0.5 - 0.5 * Math.cos(t * 0.16));
    b.trolley.position.z = (YARD.zA + YARD.zB) / 2 + Math.sin(t * 0.22) * 9;
    b.crew.forEach((c, i) => {
      const wx = c.walk ? Math.sin(t * 0.3 * c.walk + c.ph) * 4 : 0;
      const ry = c.walk ? (Math.cos(t * 0.3 * c.walk + c.ph) > 0 ? Math.PI / 2 : -Math.PI / 2) : c.ry + Math.sin(t * 0.5 + c.ph) * 0.3;
      tmp.m.compose(tmp.v.set(c.x + wx, c.y, c.z), tmp.q.setFromEuler(tmp.e.set(0, ry, 0)), tmp.s);
      b.cL.setMatrixAt(i, tmp.m); b.cV.setMatrixAt(i, tmp.m); b.cH.setMatrixAt(i, tmp.m);
    });
    b.cL.instanceMatrix.needsUpdate = true; b.cV.instanceMatrix.needsUpdate = true; b.cH.instanceMatrix.needsUpdate = true;
  });

  return <primitive object={B.g} />;
}
