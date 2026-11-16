import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { film, span, seat, smooth, clamp01 } from '../film/clock';
import { TOWER } from '../film/shots';
import { mats } from './materials';
import { rbox, merge, place, instanced, mesh, mat, rod, boxUVWorld, rand } from './geo';
import { anchor } from './anchors';

/**
 * 01 / ALUFORM SYSTEMS - a 38-storey wall-type RC tower cast with aluminium formwork.
 * Active floor runs real cycles: rebar -> wall panels -> pins & wedges -> deck -> pour -> strike & climb.
 */
const H = TOWER.half, FL = TOWER.floor;
const BASE_FLOORS = 35;
const CYCLE = 8 / 3;
const PIER = 1.2, WIN = 1.8, MOD = PIER + WIN;   // facade rhythm
const SILL = 0.9, HEAD = 2.25;                   // window opening, above slab top
const SLAB = 0.2, WALL_T = 0.2;

type Side = { k: number; at: (s: number, y: number, off: number) => THREE.Vector3; ry: number };
const SIDES: Side[] = [
  { k: 0, at: (s, y, o) => new THREE.Vector3(s, y, H + o), ry: 0 },
  { k: 1, at: (s, y, o) => new THREE.Vector3(H + o, y, -s), ry: Math.PI / 2 },
  { k: 2, at: (s, y, o) => new THREE.Vector3(-s, y, -H - o), ry: Math.PI },
  { k: 3, at: (s, y, o) => new THREE.Vector3(-H - o, y, s), ry: -Math.PI / 2 },
];
/** facade module starts along a side (s from -H to H) */
const modules = () => { const out: number[] = []; for (let s = -H + 0.4; s + MOD <= H - 0.2; s += MOD) out.push(s); return out; };

function floorGeometry() {
  const parts: THREE.BufferGeometry[] = [place(rbox(2 * H + 0.12, SLAB, 2 * H + 0.12, 0.012), 0, SLAB / 2, 0)];
  const h = FL - SLAB;
  for (const sd of SIDES) {
    const wall = (s0: number, s1: number, y0: number, y1: number) => {
      const len = s1 - s0, hh = y1 - y0;
      const g = rbox(len, hh, WALL_T, 0.01);
      const c = sd.at((s0 + s1) / 2, SLAB + (y0 + y1) / 2, -WALL_T / 2);
      parts.push(place(g, c.x, c.y, c.z, 0, sd.ry, 0));
    };
    let last = -H;
    for (const s of modules()) {
      wall(last, s + PIER, 0, h);             // pier (and corner return)
      wall(s + PIER, s + MOD, 0, SILL);        // spandrel
      wall(s + PIER, s + MOD, HEAD, h);        // lintel
      last = s + MOD;
    }
    wall(last, H, 0, h);
  }
  // central core with lift openings
  const C = 4.6, T = 0.3;
  for (const sd of SIDES) {
    const c1 = sd.at(-2.2, SLAB + h / 2, -(H - C) - T / 2);
    parts.push(place(rbox(4.6, h, T, 0.01), c1.x, c1.y, c1.z, 0, sd.ry, 0));
    const c2 = sd.at(2.9, SLAB + h / 2, -(H - C) - T / 2);
    parts.push(place(rbox(3.4, h, T, 0.01), c2.x, c2.y, c2.z, 0, sd.ry, 0));
  }
  return boxUVWorld(merge(parts), 0.35);
}

function panelGeometry(w: number, h: number) {
  const parts = [
    place(rbox(w, h, 0.006, 0.002, 1), 0, h / 2, 0.003),
    place(rbox(0.008, h, 0.065, 0.002, 1), -w / 2 + 0.004, h / 2, 0.0325),
    place(rbox(0.008, h, 0.065, 0.002, 1), w / 2 - 0.004, h / 2, 0.0325),
    place(rbox(w, 0.008, 0.065, 0.002, 1), 0, 0.004, 0.0325),
    place(rbox(w, 0.008, 0.065, 0.002, 1), 0, h - 0.004, 0.0325),
  ];
  for (let y = 0.3; y < h - 0.1; y += 0.3) parts.push(place(rbox(w - 0.016, 0.006, 0.045, 0.002, 1), 0, y, 0.0225));
  return merge(parts);
}

type PanelInst = { side: Side; s: number; y: number; w: number; geo: 'tall' | 'sill' | 'lint'; order: number };

export function Tower() {
  const M = mats();
  const root = useRef<THREE.Group>(null!);
  const built = useMemo(() => {
    const g = new THREE.Group();
    // ---------------- cast floors (instanced) + finished facade below floor 26
    const fgeo = floorGeometry();
    const floorMats: THREE.Matrix4[] = [], colors: THREE.Color[] = [];
    for (let i = 0; i < TOWER.floors; i++) {
      floorMats.push(mat(0, i * FL, 0));
      colors.push(new THREE.Color(i < 26 ? '#f1eee7' : '#e2ded6'));
    }
    const floors = instanced(fgeo, M.concreteTower, floorMats, { colors });
    floors.count = BASE_FLOORS;
    g.add(floors);
    // glazing in the punched openings of finished floors
    const paneGeo = new THREE.BoxGeometry(WIN - 0.06, HEAD - SILL - 0.06, 0.04);
    const paneMats: THREE.Matrix4[] = [];
    // facade: glazing + vertical aluminium fins on every pier + graphite slab-edge bands.
    // Floors 0-22 complete; 23-26 mid-installation (a believable facade front); 27+ raw cast concrete.
    const finMats: THREE.Matrix4[] = [], bandMats: THREE.Matrix4[] = [];
    const fr = rand(17);
    const FULL = 23, PARTIAL = 27;
    for (let i = 0; i < PARTIAL; i++) for (const sd of SIDES) {
      const partial = i >= FULL;
      const share = partial ? 1 - (i - FULL + 1) * 0.22 : 1;
      for (const s of modules()) {
        if (partial && fr() > share) continue;
        const c = sd.at(s + PIER + WIN / 2, i * FL + SLAB + (SILL + HEAD) / 2, -0.12);
        paneMats.push(mat(c.x, c.y, c.z, 0, sd.ry, 0));
        const f = sd.at(s + PIER / 2, i * FL + FL / 2, 0.2);
        finMats.push(mat(f.x, f.y, f.z, 0, sd.ry, 0));
      }
      if (!partial) {
        const b = sd.at(0, i * FL + 0.1, 0.05);
        bandMats.push(mat(b.x, b.y, b.z, 0, sd.ry, 0));
      }
    }
    g.add(instanced(paneGeo, M.glass, paneMats, { shadow: false }));
    g.add(instanced(rbox(0.16, FL - 0.02, 0.42, 0.02, 2), M.cladding, finMats));
    const graphite = new THREE.MeshStandardMaterial({ color: '#2e3940', roughness: 0.35, metalness: 0.65 });
    g.add(instanced(rbox(2 * H + 0.2, 0.34, 0.1, 0.02, 2), graphite, bandMats, { shadow: false }));
    // podium base + entrance canopy so the tower meets the ground like architecture, not a box
    const podium = mesh(boxUVWorld(rbox(2 * H + 6, 6.2, 2 * H + 6, 0.08), 0.4), M.cladding);
    podium.position.y = 3.1; g.add(podium);
    const canopy = mesh(rbox(2 * H + 9, 0.35, 4, 0.05), graphite); canopy.position.set(0, 6.4, H + 4.5); g.add(canopy);
    // dark interior volume so open floors read as depth, not as see-through
    const interior = mesh(new THREE.BoxGeometry(2 * H - 0.6, 26 * FL, 2 * H - 0.6), new THREE.MeshStandardMaterial({ color: '#23282c', roughness: 1 }), false);
    interior.position.y = 13 * FL; g.add(interior);
    const interiorTop = mesh(new THREE.BoxGeometry(2 * H - 9, 12 * FL, 2 * H - 9), new THREE.MeshStandardMaterial({ color: '#2b2f32', roughness: 1 }), false);
    interiorTop.position.y = 26 * FL + 6 * FL; g.add(interiorTop);

    // ---------------- reshoring props on the 3 floors under the active one (visible through the openings)
    const propGeo = new THREE.CylinderGeometry(0.03, 0.03, FL - SLAB, 6);
    const propMats: THREE.Matrix4[] = [];
    for (let k = 0; k < 3; k++) for (let x = -10; x <= 10; x += 2.5) for (let z = -10; z <= 10; z += 2.5) {
      if (Math.abs(x) < 4 && Math.abs(z) < 4) continue;
      propMats.push(mat(x, 0, z));
    }
    const props = instanced(propGeo, M.steelGalv, propMats, { shadow: false });
    g.add(props);

    // ---------------- active Aluform kit
    const tall = panelGeometry(0.6, FL - SLAB), sill = panelGeometry(0.6, SILL), lint = panelGeometry(0.6, FL - SLAB - HEAD);
    const insts: PanelInst[] = [];
    let order = 0;
    for (const sd of SIDES) {
      let last = -H;
      const addRun = (a: number, b: number, geo: PanelInst['geo'], y: number) => {
        for (let s = a; s + 0.6 <= b + 0.001; s += 0.6) insts.push({ side: sd, s: s + 0.3, y, w: 0.6, geo, order: order++ });
      };
      for (const s of modules()) {
        addRun(last, s + PIER, 'tall', 0);
        addRun(s + PIER, s + MOD, 'sill', 0);
        addRun(s + PIER, s + MOD, 'lint', HEAD);
        last = s + MOD;
      }
      addRun(last, H - 0.4, 'tall', 0);
    }
    const byGeo = { tall: insts.filter((p) => p.geo === 'tall'), sill: insts.filter((p) => p.geo === 'sill'), lint: insts.filter((p) => p.geo === 'lint') };
    const pTall = instanced(tall, M.aluminium, byGeo.tall.map(() => new THREE.Matrix4()));
    const pSill = instanced(sill, M.aluminium, byGeo.sill.map(() => new THREE.Matrix4()));
    const pLint = instanced(lint, M.aluminium, byGeo.lint.map(() => new THREE.Matrix4()));
    g.add(pTall, pSill, pLint);
    // pins + wedges on every vertical joint of the tall panels
    const pinGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.1, 8).rotateZ(Math.PI / 2);
    const wedgeGeo = rbox(0.004, 0.13, 0.03, 0.0015, 1);
    const joints = byGeo.tall.flatMap((p) => [0.35, 0.95, 1.55, 2.15].map((dy) => ({ ...p, dy })));
    const pins = instanced(pinGeo, M.zinc, joints.map(() => new THREE.Matrix4()), { shadow: false });
    const wedges = instanced(wedgeGeo, M.zinc, joints.map(() => new THREE.Matrix4()), { shadow: false });
    g.add(pins, wedges);
    // rebar: vertical bars in the walls of the active floor (grow from the slab)
    const barGeo = new THREE.CylinderGeometry(0.008, 0.008, 1, 6).translate(0, 0.5, 0);
    const barMats: THREE.Matrix4[] = [];
    for (const sd of SIDES) for (let s = -H + 0.3; s < H - 0.2; s += 0.2) {
      const c = sd.at(s, 0, -WALL_T / 2);
      barMats.push(mat(c.x, 0, c.z));
    }
    const rebar = instanced(barGeo, M.rebar, barMats, { shadow: false });
    g.add(rebar);
    // deck (slab soffit forms) + wet pour + edge form
    const deck = mesh(rbox(2 * H - 0.3, 0.07, 2 * H - 0.3, 0.01), M.aluminium);
    const pour = mesh(new THREE.BoxGeometry(1, 0.2, 2 * H - 0.4), M.wetConcrete, false);
    const edgeForm = mesh(merge(SIDES.map((sd) => { const c = sd.at(0, 0.11, 0.02); return place(rbox(2 * H + 0.1, 0.22, 0.03, 0.005), c.x, c.y, c.z, 0, sd.ry, 0); })), M.aluminium);
    g.add(deck, pour, edgeForm);
    // fresh-cast floor: the strike reveals it (wet-dark -> cured over the time-lapse)
    const freshMat = M.concreteTower.clone(); freshMat.color.set('#6d6a64');
    const fresh = mesh(fgeo, freshMat);
    g.add(fresh);
    // edge protection screens on the two far sides (keeps the camera-facing formwork readable)
    // far sides only (-Z and +X); the camera's arc covers +Z and -X
    const screenGeo = merge([place(new THREE.PlaneGeometry(2 * H + 2, 7.4), 0, 0, -H - 1.2), place(new THREE.PlaneGeometry(2 * H + 2, 7.4), H + 1.2, 0, 0, 0, Math.PI / 2, 0)]);
    const screen = mesh(screenGeo, M.screen, false);
    g.add(screen);

    // ---------------- tower crane (behind the tower, away from the camera arc) + placing boom on the deck
    const crane = new THREE.Group();
    const mastH = 136;
    const mast = mesh(new THREE.BoxGeometry(2.0, mastH, 2.0), M.lattice, false); mast.position.set(0, mastH / 2, 0);
    const jibTex = M.lattice.clone();
    const jib = mesh(new THREE.BoxGeometry(62, 1.8, 1.6), jibTex, false); jib.position.set(-24, mastH + 1, 0);
    const counter = mesh(new THREE.BoxGeometry(16, 1.6, 1.6), M.lattice, false); counter.position.set(9, mastH + 1, 0);
    const cw = mesh(rbox(3, 2.6, 2.2, 0.05), M.concrete); cw.position.set(15, mastH - 0.6, 0);
    const cab = mesh(rbox(2.2, 2.4, 2.2, 0.08), M.cladding); cab.position.set(0, mastH - 1.4, 1.8);
    const apex = mesh(new THREE.BoxGeometry(1.4, 9, 1.4), M.lattice, false); apex.position.set(0, mastH + 6, 0);
    crane.add(mast, jib, counter, cw, cab, apex);
    crane.position.set(19.5, 0, -19.5); crane.rotation.y = Math.PI * 0.82;
    g.add(crane);
    const boom = new THREE.Group();
    const bm = M.cladding;
    const mastB = mesh(new THREE.CylinderGeometry(0.35, 0.35, 8, 16), bm); mastB.position.y = 4;
    const arm1 = mesh(rbox(10, 0.45, 0.4, 0.05), bm); arm1.position.set(4.6, 8.8, 0); arm1.rotation.z = 0.22;
    const arm2 = mesh(rbox(8, 0.36, 0.32, 0.04), bm); arm2.position.set(12.6, 8.9, 0); arm2.rotation.z = -0.25;
    const hose = mesh(new THREE.CylinderGeometry(0.07, 0.07, 6.5, 10), M.tyre); hose.position.set(16.4, 4.6, 0);
    boom.add(mastB, arm1, arm2, hose);
    g.add(boom);

    // ---------------- ground staging: foreground materials for the low-angle opening
    const stackGeo = merge(Array.from({ length: 12 }, (_, i) => place(panelGeometry(0.6, 2.7).rotateX(-Math.PI / 2), 0, 0.08 * i + 0.04, 0)));
    const stacks = [mat(19, 0.12, 27, 0, 0.3, 0), mat(20.4, 0.12, 25.4, 0, 0.32, 0), mat(17.2, 0.12, 29.6, 0, 0.25, 0)];
    g.add(instanced(stackGeo, M.aluminium, stacks));
    const pallet = rbox(1.2, 0.12, 2.9, 0.01);
    g.add(instanced(pallet, M.timber, stacks.map((m) => m.clone().multiply(mat(0, -0.06, 0)))));
    const r = rand(9);
    const bundle = merge(Array.from({ length: 24 }, (_, i) => rod(new THREE.Vector3((i % 6) * 0.04, 0.05 + Math.floor(i / 6) * 0.04, -3), new THREE.Vector3((i % 6) * 0.04 + r() * 0.02, 0.05 + Math.floor(i / 6) * 0.04, 3), 0.012, 5)));
    g.add(instanced(bundle, M.rebar, [mat(24, 0.1, 18, 0, 0.6, 0), mat(25.2, 0.1, 17.2, 0, 0.62, 0)]));
    const hoarding = mesh(boxUVWorld(merge([place(rbox(60, 2.4, 0.06, 0.01), 0, 1.2, 0)]), 0.5), M.claddingDark);
    hoarding.position.set(0, 0, 64); g.add(hoarding);   // behind both desktop and phone camera starts
    const plaza = mesh(new THREE.BoxGeometry(110, 0.1, 110), M.paved, false); plaza.position.y = 0.05; plaza.receiveShadow = true; g.add(plaza);

    return { g, floors, props, pTall, pSill, pLint, byGeo, pins, wedges, joints, rebar, deck, pour, edgeForm, fresh, freshMat, screen, boom };
  }, [M]);

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), v: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3(1, 1, 1) }), []);

  useFrame(() => {
    const t = film.t;
    const b = built;
    let c = Math.min(2, Math.floor(Math.max(0, t) / CYCLE));
    let u = (Math.max(0, t) - c * CYCLE) / CYCLE;
    if (c === 2) u = Math.min(u, 0.74);
    if (t >= 8) { c = 2; u = 0.74; }
    const level = BASE_FLOORS + c;
    const y0 = level * FL;
    b.floors.count = level;
    // props under the active floor
    b.props.position.y = y0 - 3 * FL + SLAB;
    b.props.scale.set(1, 1, 1);
    // rebar growth
    const rg = span(u, 0.0, 0.14);
    b.rebar.visible = u < 0.9;
    b.rebar.position.y = y0 + SLAB; b.rebar.scale.set(1, Math.max(0.01, (FL + 0.6) * smooth(rg)), 1);
    // panels: approach from outside + above, seat; strike: out and up
    const place = (inst: THREE.InstancedMesh, list: PanelInst[]) => {
      const n = list.length;
      list.forEach((p, i) => {
        const k = i / n;
        const a = clamp01((span(u, 0.1, 0.44) - k * 0.55) / 0.45);
        const inn = seat(a);
        const strike = smooth(span(u, 0.8, 1.0));
        const out = (1 - inn) * 1.4 + strike * 0.6;
        const up = (1 - inn) * 0.7 + strike * FL;
        const v = p.side.at(p.s, y0 + SLAB + p.y + up, out);
        tmp.m.compose(v, tmp.q.setFromEuler(tmp.e.set(0, p.side.ry, 0)), tmp.s.set(1, 1, 1));
        inst.setMatrixAt(i, tmp.m);
      });
      inst.instanceMatrix.needsUpdate = true;
    };
    place(b.pTall, b.byGeo.tall); place(b.pSill, b.byGeo.sill); place(b.pLint, b.byGeo.lint);
    // pins & wedges seat after the panels (staggered)
    const strikeOut = smooth(span(u, 0.8, 0.86));
    b.joints.forEach((j, i) => {
      const a = clamp01((span(u, 0.4, 0.52) - (i / b.joints.length) * 0.6) / 0.4) * (1 - strikeOut);
      const sc = a > 0.001 ? 1 : 0.0001;
      const v = j.side.at(j.s + 0.3, y0 + SLAB + j.dy, 0.04 + (1 - seat(a)) * 0.25);
      tmp.m.compose(v, tmp.q.setFromEuler(tmp.e.set(0, j.side.ry, 0)), tmp.s.set(sc, sc, sc));
      b.pins.setMatrixAt(i, tmp.m);
      const w = j.side.at(j.s + 0.3 + 0.03, y0 + SLAB + j.dy + (1 - seat(a)) * 0.12, 0.05);
      tmp.m.compose(w, tmp.q, tmp.s);
      b.wedges.setMatrixAt(i, tmp.m);
    });
    b.pins.instanceMatrix.needsUpdate = true; b.wedges.instanceMatrix.needsUpdate = true;
    // deck assembles from the core outward, pour sweeps across it, strike lifts it with the panels
    const dk = seat(span(u, 0.46, 0.62));
    const climb = smooth(span(u, 0.82, 1.0)) * FL;
    b.deck.visible = dk > 0.01;
    b.deck.scale.set(Math.max(0.01, dk), 1, Math.max(0.01, dk));
    b.deck.position.y = y0 + FL - 0.035 + climb;
    b.edgeForm.position.y = y0 + FL + climb;
    b.edgeForm.visible = dk > 0.95;
    const pr = span(u, 0.62, 0.78);
    b.pour.visible = pr > 0 && u < 0.84;
    b.pour.scale.x = Math.max(0.01, (2 * H - 0.4) * pr);
    b.pour.position.set(-H + 0.2 + ((2 * H - 0.4) * pr) / 2, y0 + FL + 0.1, 0);
    // fresh floor: appears at strike, cures from dark to grey (an explicit time-lapse)
    const fr = span(u, 0.8, 1.0);
    b.fresh.visible = u >= 0.8 && t < 8;
    b.fresh.position.y = y0;
    b.freshMat.color.setRGB(0.43 + 0.38 * fr, 0.42 + 0.37 * fr, 0.39 + 0.36 * fr);
    b.screen.position.y = y0 + 1.6 + climb;
    b.boom.position.set(-3, y0 + FL + 0.04 + climb, -2);
    anchor('aluform', -H + 0.2, y0 + 1.6, H * 0.35);
  });

  return <primitive object={built.g} />;
}
