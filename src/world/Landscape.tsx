import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mats } from './materials';
import { merge, place, instanced, mesh, mat, rand, boxUVWorld } from './geo';
import { SITE_ORIGIN, CAMPUS, NODES, SITE_CENTRE } from '../film/shots';
import { film } from '../film/clock';

/**
 * The world around the films.
 * - Scene 1: a white massing city (architectural-model look) on a pale ground that carries the data rings, with
 *   the controlled site (in full colour) at its centre.
 * - Scenes 2-3: the southern city is swapped for the semi-urban fringe (houses, palms, laterite earth) so the
 *   everyday site sits ~0.9 km from the district, with the giants' skyline on its horizon.
 */
const RING_Z = -330;

/** keep the controlled site, its margin and every Scene 1 camera path clear */
const CEN = [6, 0, 4];
function blocked(x: number, z: number, pad = 0) {
  if (x > CAMPUS.x0 - 34 - pad && x < CAMPUS.x1 + 34 + pad && z < CAMPUS.z0 + 34 + pad && z > CAMPUS.z1 - 34 - pad) return true;
  // aerial corridor: the south / south-east sector the Scene 1 cameras fly through (low blocks only further out)
  const dx = x - CEN[0], dz = z - CEN[2];
  const r = Math.hypot(dx, dz), az = (Math.atan2(dz, dx) * 180) / Math.PI;
  if (r < 190 && az > -5 && az < 128) return true;
  return false;
}
/** inside the camera sector but beyond the near corridor: keep buildings low so no tower crosses a flight line */
function lowOnly(x: number, z: number) {
  const dx = x - CEN[0], dz = z - CEN[2];
  const r = Math.hypot(dx, dz), az = (Math.atan2(dz, dx) * 180) / Math.PI;
  return r < 760 && az > -12 && az < 135;
}

export function Landscape() {
  const M = mats();
  const w = useMemo(() => {
    const north = new THREE.Group(), south1 = new THREE.Group(), fringe = new THREE.Group();
    const r = rand(77);

    // ---------------- ground (pale, carries the data rings)
    const districtGround = mesh(new THREE.PlaneGeometry(7000, 3500).rotateX(-Math.PI / 2), M.groundDistrict, false);
    districtGround.position.set(0, 0, RING_Z + 1750); districtGround.receiveShadow = true; north.add(districtGround);
    const southWhite = mesh(new THREE.PlaneGeometry(7000, 4000).rotateX(-Math.PI / 2), M.groundDistrict, false);
    southWhite.position.set(0, -0.01, RING_Z - 2000); southWhite.receiveShadow = true; south1.add(southWhite);
    const land = mesh(new THREE.PlaneGeometry(7000, 4000).rotateX(-Math.PI / 2), M.earth, false);
    land.position.set(0, -0.02, RING_Z - 2000); land.receiveShadow = true; fringe.add(land);

    // district streets (light, model-like): a ring street round the site, then the city grid
    const { x0, x1, z0, z1 } = CAMPUS;
    const roads: THREE.BufferGeometry[] = [
      place(new THREE.BoxGeometry(7000, 0.06, 26), 0, 0.03, RING_Z),
      place(new THREE.BoxGeometry(2400, 0.05, 18), 0, 0.025, z0 + 14), place(new THREE.BoxGeometry(2400, 0.05, 18), 0, 0.025, z1 - 14),
      place(new THREE.BoxGeometry(18, 0.05, 2400), x0 - 14, 0.025, 300), place(new THREE.BoxGeometry(18, 0.05, 2400), x1 + 14, 0.025, 300),
      place(new THREE.BoxGeometry(2400, 0.05, 14), 0, 0.025, 250), place(new THREE.BoxGeometry(2400, 0.05, 14), 0, 0.025, -232),
      place(new THREE.BoxGeometry(14, 0.05, 2400), -330, 0.025, 300), place(new THREE.BoxGeometry(14, 0.05, 2400), 340, 0.025, 300),
    ];
    const roadMesh = mesh(merge(roads), M.roadDistrict, false); roadMesh.receiveShadow = true; north.add(roadMesh);

    // ---------------- city massing: plain white blocks and towers (architectural-model convention); detail belongs
    // to the live site in the middle
    const facade = ['#f3f3f1', '#eceeef', '#f6f5f2', '#e9ecee', '#f1efeb', '#edf0f1'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, metalness: 0 }));
    const geos = [[24, 30], [32, 24], [20, 20], [40, 28], [28, 28], [18, 34]].map(([wd, d]) => new THREE.BoxGeometry(wd, 1, d).translate(0, 0.5, 0));
    const bucketsN: THREE.Matrix4[][] = geos.map(() => []), bucketsS: THREE.Matrix4[][] = geos.map(() => []);
    const put = (x: number, z: number, h: number) => {
      const k = Math.floor(r() * geos.length);
      const list = z > RING_Z ? bucketsN : bucketsS;
      list[k].push(mat(x, 0, z, 0, (Math.floor(r() * 4) * Math.PI) / 2 + (r() - 0.5) * 0.15, 0, 1, h, 1));
      if (r() < 0.45) list[(k + 2) % 6].push(mat(x, h, z, 0, 0, 0, 0.62, h * (0.06 + r() * 0.16), 0.62));   // stepped crown
    };
    for (let i = 0; i < 640; i++) {
      const a = r() * Math.PI * 2, rad = 230 + 1950 * Math.pow(r(), 0.85);
      const x = CEN[0] + rad * Math.cos(a), z = CEN[2] + rad * Math.sin(a);
      if (blocked(x, z)) continue;
      // low context near the site so the live work leads; height grows with distance
      const near = Math.min(1, (rad - 230) / 900);
      const tall = r() < 0.05 + 0.18 * near;
      const hh = tall ? 90 + r() * 120 * (0.5 + near) : 14 + r() * (24 + 50 * near);
      put(x, z, lowOnly(x, z) ? Math.min(hh, 18 + r() * 10) : hh);
    }
    // the giants: a dense CBD well north of the site (also the skyline seen from the everyday site in films 2-3)
    for (let i = 0; i < 52; i++) {
      const x = -700 + r() * 1400, z = 420 + Math.pow(r(), 0.6) * 1300;
      if (blocked(x, z, 10)) continue;
      put(x, z, 130 + Math.pow(r(), 1.6) * 230);
    }
    geos.forEach((geo, k) => {
      north.add(instanced(geo, facade[k], bucketsN[k], { shadow: true }));
      south1.add(instanced(geo, facade[k], bucketsS[k], { shadow: false }));
    });
    // low podium blocks between towers for ground texture
    const lowGeo = boxUVWorld(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), 1);
    const lowsN: THREE.Matrix4[] = [], lowsS: THREE.Matrix4[] = [];
    for (let i = 0; i < 460; i++) {
      const a = r() * Math.PI * 2, rad = 200 + 1600 * Math.pow(r(), 0.8);
      const x = CEN[0] + rad * Math.cos(a), z = CEN[2] + rad * Math.sin(a);
      if (blocked(x, z, 12)) continue;
      (z > RING_Z ? lowsN : lowsS).push(mat(x, 0, z, 0, 0, 0, 30 + r() * 40, 5 + r() * 9, 30 + r() * 40));
    }
    north.add(instanced(lowGeo, M.massing, lowsN, { shadow: true }));
    south1.add(instanced(lowGeo, M.massing, lowsS, { shadow: false }));

    // ---------------- the semi-urban fringe (Scenes 2-3)
    const [sx, , sz] = SITE_ORIGIN;
    const houseGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const hb: THREE.Matrix4[][] = [[], [], [], []];
    const roofs: THREE.Matrix4[] = [], tanks: THREE.Matrix4[] = [], parapets: THREE.Matrix4[] = [];
    const nearSite = (x: number, z: number) => Math.abs(x - (sx - 4.5)) < 40 && Math.abs(z - (sz + 7.5)) < 46;
    const fringeLanes: THREE.BufferGeometry[] = [];
    for (let i = -9; i <= 9; i++) fringeLanes.push(place(new THREE.BoxGeometry(7, 0.05, 1100), sx - 4.5 + i * 64 + 32, 0.025, RING_Z - 560));
    for (let j = 0; j < 14; j++) fringeLanes.push(place(new THREE.BoxGeometry(1300, 0.05, 6), sx, 0.025, RING_Z - 70 - j * 76));
    fringeLanes.push(place(new THREE.BoxGeometry(1300, 0.06, 9), sx, 0.03, sz - 11.5));
    const laneMesh = mesh(merge(fringeLanes), M.asphalt, false); laneMesh.receiveShadow = true; fringe.add(laneMesh);
    for (let i = 0; i < 2600; i++) {
      const x = sx + (r() - 0.5) * 1200;
      const z = RING_Z - 60 - Math.pow(r(), 0.75) * 1100;
      if (nearSite(x, z)) continue;
      if (NODES.some((n) => Math.hypot(x - (SITE_CENTRE[0] + n.dx), z - (SITE_CENTRE[2] + n.dz)) < 24)) continue;   // the finale's plots
      const lx = ((x - (sx - 4.5) + 32) % 64 + 64) % 64, lz = ((z - (RING_Z - 70)) % 76 + 76) % 76;
      if (lx < 6 || lx > 58 || lz < 5) continue;                                     // keep lanes clear
      const wd = 6 + r() * 6, d = 8 + r() * 7, h = 3.1 * (1 + Math.floor(r() * r() * 3.2));
      const ry = (Math.floor(r() * 2) * Math.PI) / 2 + (r() - 0.5) * 0.08;
      hb[Math.floor(r() * 4)].push(mat(x, 0, z, 0, ry, 0, wd, h, d));
      roofs.push(mat(x, h, z, 0, ry, 0, wd + 0.3, 0.16, d + 0.3));
      if (r() < 0.5) parapets.push(mat(x, h + 0.16, z, 0, ry, 0, wd + 0.3, 0.9, d + 0.3));
      if (r() < 0.65) tanks.push(mat(x + (r() - 0.5) * wd * 0.5, h + 0.16, z + (r() - 0.5) * d * 0.5));
    }
    hb.forEach((list, i) => fringe.add(instanced(houseGeo, M.house[i], list, { shadow: true })));
    fringe.add(instanced(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), M.roof, roofs, { shadow: false }));
    const parapetGeo = merge([place(new THREE.BoxGeometry(1, 1, 0.04), 0, 0.5, 0.48), place(new THREE.BoxGeometry(1, 1, 0.04), 0, 0.5, -0.48), place(new THREE.BoxGeometry(0.04, 1, 1), 0.48, 0.5, 0), place(new THREE.BoxGeometry(0.04, 1, 1), -0.48, 0.5, 0)]);
    fringe.add(instanced(parapetGeo, M.roof, parapets, { shadow: false }));
    fringe.add(instanced(new THREE.CylinderGeometry(0.62, 0.62, 1.25, 14).translate(0, 0.62, 0), M.tank, tanks, { shadow: false }));

    const root = new THREE.Group();
    root.add(north, south1, fringe);
    return { root, south1, fringe };
  }, [M]);

  useFrame(() => {
    w.south1.visible = film.scene === 1;
    w.fringe.visible = film.scene !== 1;
  });
  return <primitive object={w.root} />;
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
