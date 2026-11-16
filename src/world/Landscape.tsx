import { useMemo } from 'react';
import * as THREE from 'three';
import { mats, patchWorldUV } from './materials';
import { cityFacade } from './textures';
import { rbox, merge, place, instanced, mesh, mat, rand, boxUVWorld } from './geo';
import { SITE_ORIGIN, TOWER, PRECAST, FACTORY } from '../film/shots';

/**
 * The connected world: advanced district (z > -610) -> ring road -> open land ("the gap") -> semi-urban fringe.
 * Background geometry is cheap (instanced boxes with world-scaled facade textures); hero geometry lives elsewhere.
 */
const RING_Z = -610;

function scaledUV(g: THREE.BufferGeometry, su: number, sv: number) {
  boxUVWorld(g, 1);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / su, uv.getY(i) / sv);
  return g;
}

/** keep the hero buildings and the camera corridor clear */
function blocked(x: number, z: number, pad = 0) {
  if (Math.abs(x - TOWER.x) < 70 + pad && Math.abs(z - TOWER.z) < 80 + pad) return true;
  if (Math.abs(x - PRECAST.x) < 55 + pad && Math.abs(z - PRECAST.z) < 55 + pad) return true;
  if (x > FACTORY.x0 - 45 - pad && x < FACTORY.x1 + 40 + pad && z < FACTORY.z0 + 40 && z > FACTORY.z1 - 40) return true;
  if (x > -150 && x < 120 && z < 120 && z > RING_Z) return true;     // the camera corridor through the district
  return false;
}

export function Landscape({ mobile }: { mobile: boolean }) {
  const M = mats();
  const g = useMemo(() => {
    const root = new THREE.Group();
    const r = rand(77);
    // ---------------- ground: district paving, the gap (open earth), the fringe (laterite)
    const district = mesh(new THREE.PlaneGeometry(6000, 3200).rotateX(-Math.PI / 2), M.groundCity, false);
    district.position.set(0, 0, RING_Z + 1600); district.receiveShadow = true; root.add(district);
    const land = mesh(new THREE.PlaneGeometry(6000, 4000).rotateX(-Math.PI / 2), M.earth, false);
    land.position.set(0, -0.02, RING_Z - 2000); land.receiveShadow = true; root.add(land);
    // roads: ring road, district avenues/cross streets, fringe lanes
    const roads: THREE.BufferGeometry[] = [
      place(new THREE.BoxGeometry(6000, 0.06, 26), 0, 0.03, RING_Z),
      place(new THREE.BoxGeometry(18, 0.06, 1400), -24, 0.03, RING_Z + 700),
      place(new THREE.BoxGeometry(18, 0.06, 1400), 92, 0.03, RING_Z + 700),
      place(new THREE.BoxGeometry(1600, 0.06, 16), 0, 0.03, -150),
      place(new THREE.BoxGeometry(1600, 0.06, 16), 0, 0.03, -345),
    ];
    for (let i = -6; i <= 6; i++) roads.push(place(new THREE.BoxGeometry(7, 0.05, 900), i * 88 + r() * 20, 0.025, RING_Z - 480));
    for (let j = 0; j < 7; j++) roads.push(place(new THREE.BoxGeometry(1200, 0.05, 7), 0, 0.025, RING_Z - 90 - j * 95 - r() * 20));
    const roadMesh = mesh(merge(roads), M.asphalt, false); roadMesh.receiveShadow = true; root.add(roadMesh);

    // ---------------- district skyline (instanced by size class, world-scaled facades)
    const classes = Array.from({ length: 6 }, (_, i) => cityFacade(100 + i));
    const facadeMats = classes.map((c, i) => patchWorldUV(new THREE.MeshStandardMaterial({ map: c.map, color: ['#ffffff', '#e8eef3', '#f2efe9', '#dfe6ec', '#ece7df', '#e4e9ee'][i], roughness: 0.35, metalness: 0.25, envMapIntensity: 1.1 }), 16, 112));
    const towerGeos = [[24, 30], [32, 24], [20, 20], [40, 28], [28, 28], [18, 34]].map(([w, d]) => new THREE.BoxGeometry(w, 1, d).translate(0, 0.5, 0));
    const buckets: THREE.Matrix4[][] = towerGeos.map(() => []);
    for (let i = 0; i < (mobile ? 260 : 420); i++) {
      const a = r() * Math.PI * 2, rad = 160 + 1700 * Math.pow(r(), 0.8);
      const x = rad * Math.cos(a), z = -250 + rad * Math.sin(a);
      if (z < RING_Z + 30 || blocked(x, z)) continue;
      const tall = r() < 0.12;
      const h = tall ? 110 + r() * 90 : 30 + r() * 70;
      const k = Math.floor(r() * towerGeos.length);
      buckets[k].push(mat(x, 0, z, 0, (Math.floor(r() * 4) * Math.PI) / 2 + (r() - 0.5) * 0.2, 0, 1, h, 1));
      if (r() < 0.4) buckets[(k + 2) % 6].push(mat(x, h, z, 0, 0, 0, 0.62, h * (0.08 + r() * 0.18), 0.62));  // stepped crown
    }
    towerGeos.forEach((geo, k) => root.add(instanced(geo, facadeMats[k], buckets[k], { shadow: false })));
    // low-rise district blocks between the towers (podiums, malls, parking) for ground-level texture
    const lowGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const lows: THREE.Matrix4[] = [];
    for (let i = 0; i < 260; i++) {
      const x = (r() - 0.5) * 1800, z = RING_Z + 40 + r() * 1500;
      if (blocked(x, z, 10)) continue;
      lows.push(mat(x, 0, z, 0, 0, 0, 30 + r() * 40, 8 + r() * 14, 30 + r() * 40));
    }
    root.add(instanced(lowGeo, facadeMats[2], lows, { shadow: false }));

    // ---------------- far horizon skyline beyond the fringe (keeps the -Z view from feeling empty)
    const farGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const fars: THREE.Matrix4[] = [];
    for (let i = 0; i < 90; i++) fars.push(mat((r() - 0.5) * 3600, 0, -2600 - r() * 900, 0, 0, 0, 30 + r() * 40, 30 + r() * 90, 30 + r() * 40));
    root.add(instanced(farGeo, facadeMats[3], fars, { shadow: false }));

    // ---------------- the semi-urban fringe: houses (4 paint colours), roof slabs, water tanks
    const [sx, , sz] = SITE_ORIGIN;
    const houseGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const hb: THREE.Matrix4[][] = [[], [], [], []];
    const roofs: THREE.Matrix4[] = [], tanks: THREE.Matrix4[] = [];
    const nearSite = (x: number, z: number) => Math.abs(x - (sx - 4.5)) < 45 && Math.abs(z - (sz + 7.5)) < 50;
    const N = mobile ? 1300 : 2100;
    for (let i = 0; i < N; i++) {
      const x = (r() - 0.5) * 1100;
      const z = RING_Z - 95 - Math.pow(r(), 0.7) * 820;
      if (nearSite(x, z)) continue;
      if (Math.abs(((x + 540) % 88) - 44) > 40 && r() < 0.5) continue;           // leave the lanes
      const w = 6 + r() * 6, d = 8 + r() * 7, h = 3.1 * (1 + Math.floor(r() * r() * 3.2));
      const ry = (Math.floor(r() * 2) * Math.PI) / 2 + (r() - 0.5) * 0.12;
      hb[Math.floor(r() * 4)].push(mat(x, 0, z, 0, ry, 0, w, h, d));
      roofs.push(mat(x, h, z, 0, ry, 0, w + 0.3, 0.16, d + 0.3));
      if (r() < 0.7) tanks.push(mat(x + (r() - 0.5) * w * 0.5, h + 0.16, z + (r() - 0.5) * d * 0.5));
    }
    hb.forEach((list, i) => root.add(instanced(houseGeo, M.house[i], list, { shadow: !mobile })));
    root.add(instanced(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), M.roof, roofs, { shadow: false }));
    root.add(instanced(new THREE.CylinderGeometry(0.62, 0.62, 1.25, 14).translate(0, 0.62, 0), M.tank, tanks, { shadow: false }));

    // ---------------- vegetation: coconut palms + neem (instanced crowns)
    const palm = palmGeometry();
    const crowns: THREE.Matrix4[] = [], trunks: THREE.Matrix4[] = [], canopies: THREE.Matrix4[] = [];
    const neem = neemGeometry();
    for (let i = 0; i < (mobile ? 600 : 1100); i++) {
      const x = (r() - 0.5) * 1100, z = RING_Z - 60 - Math.pow(r(), 0.8) * 860;
      if (nearSite(x, z)) continue;
      const ry = r() * Math.PI * 2;
      if (r() < 0.62) {
        const h = 9 + r() * 7, lx = (r() - 0.5) * 0.2, lz = (r() - 0.5) * 0.2;
        trunks.push(mat(x, 0, z, lx, ry, lz, 1, h, 1));
        crowns.push(mat(x + Math.sin(lz) * -h, h, z + Math.sin(lx) * h, 0, ry, 0, 1, 1, 1));
      } else {
        const s = 0.8 + r() * 0.6;
        canopies.push(mat(x, 0, z, 0, ry, 0, s, s, s));
      }
    }
    root.add(instanced(new THREE.CylinderGeometry(0.14, 0.2, 1, 7).translate(0, 0.5, 0), M.trunk, trunks, { shadow: false }));
    root.add(instanced(palm, M.frond, crowns, { shadow: !mobile }));
    root.add(instanced(neem, M.canopy, canopies, { shadow: !mobile }));
    return root;
  }, [M, mobile]);
  return <primitive object={g} />;
}

/** coconut palm crown: 13 arched, tapering fronds with a leaflet comb silhouette */
export function palmGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const r = rand(5);
  for (let k = 0; k < 13; k++) {
    const a = (k / 13) * Math.PI * 2 + (r() - 0.5) * 0.3;
    const L = 4.2 + r() * 1.2, droop = 0.6 + r() * 0.8;
    const pos: number[] = [];
    const seg = 10;
    for (let i = 0; i < seg; i++) {
      const t0 = i / seg, t1 = (i + 1) / seg;
      const P = (t: number) => [t * L, 0.9 * Math.sin(t * 2.2) - droop * t * t * 2, 0] as const;
      const w0 = 0.7 * Math.sin(Math.PI * Math.min(1, t0 * 1.1 + 0.05)), w1 = 0.7 * Math.sin(Math.PI * Math.min(1, t1 * 1.1 + 0.05));
      const a0 = P(t0), a1 = P(t1);
      // leaflets: alternate wide/narrow strips read as a comb at distance
      const f = i % 2 ? 0.55 : 1;
      pos.push(a0[0], a0[1], 0, a1[0], a1[1], 0, a1[0], a1[1] - 0.12, w1 * f, a0[0], a0[1], 0, a1[0], a1[1] - 0.12, w1 * f, a0[0], a0[1] - 0.12, w0 * f);
      pos.push(a0[0], a0[1], 0, a0[0], a0[1] - 0.12, -w0 * f, a1[0], a1[1] - 0.12, -w1 * f, a0[0], a0[1], 0, a1[0], a1[1] - 0.12, -w1 * f, a1[0], a1[1], 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    geo.rotateZ(-0.1 + (r() - 0.5) * 0.3); geo.rotateY(a);
    parts.push(geo);
  }
  return merge(parts);
}

/** neem: clumped lumpy canopy on a short trunk */
export function neemGeometry() {
  const r = rand(9);
  const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.22, 0.32, 5, 7).translate(0, 2.5, 0)];
  for (let i = 0; i < 9; i++) {
    const s = 1.6 + r() * 1.6;
    const g = new THREE.IcosahedronGeometry(s, 2);
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) {
      const n = 1 + 0.18 * Math.sin(p.getX(k) * 3.1 + p.getY(k) * 2.3) * Math.cos(p.getZ(k) * 2.7);
      p.setXYZ(k, p.getX(k) * n, p.getY(k) * n * 0.8, p.getZ(k) * n);
    }
    g.computeVertexNormals();
    g.translate((r() - 0.5) * 4.5, 6 + r() * 3, (r() - 0.5) * 4.5);
    parts.push(g);
  }
  return merge(parts);
}
