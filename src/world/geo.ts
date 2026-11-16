import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** bevelled box (premium edges). r = bevel radius in metres; small parts get segments 2 */
export function rbox(w: number, h: number, d: number, r = 0.01, seg = 2) {
  const rr = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  if (rr <= 0.0005) return new THREE.BoxGeometry(w, h, d);
  return new RoundedBoxGeometry(w, h, d, seg, rr);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
export function mat(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}
export function place(g: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  return g.applyMatrix4(mat(x, y, z, rx, ry, rz));
}
/** merge a list of geometries (all non-indexed or all indexed handled) */
export function merge(list: THREE.BufferGeometry[]) {
  const norm = list.map((g) => {
    let n = g.index ? g.toNonIndexed() : g;
    // keep only position/normal/uv so differing attribute sets still merge
    const keep = new THREE.BufferGeometry();
    keep.setAttribute('position', n.getAttribute('position'));
    if (n.getAttribute('normal')) keep.setAttribute('normal', n.getAttribute('normal')); else { n.computeVertexNormals(); keep.setAttribute('normal', n.getAttribute('normal')); }
    if (n.getAttribute('uv')) keep.setAttribute('uv', n.getAttribute('uv'));
    else keep.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.getAttribute('position').count * 2), 2));
    return keep;
  });
  const g = mergeGeometries(norm, false)!;
  g.computeBoundingSphere();
  return g;
}

/** box UVs in world-ish metres so tiled textures keep real scale on merged geometry */
export function boxUVWorld(g: THREE.BufferGeometry, scale = 1) {
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * scale; uv[i * 2 + 1] = v * scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export function instanced(geo: THREE.BufferGeometry, material: THREE.Material, matrices: THREE.Matrix4[], opts: { shadow?: boolean; receive?: boolean; colors?: THREE.Color[] } = {}) {
  const m = new THREE.InstancedMesh(geo, material, Math.max(1, matrices.length));
  matrices.forEach((mx, i) => m.setMatrixAt(i, mx));
  m.count = matrices.length;
  if (opts.colors) opts.colors.forEach((c, i) => m.setColorAt(i, c));
  m.castShadow = opts.shadow ?? true;
  m.receiveShadow = opts.receive ?? true;
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  m.frustumCulled = false;
  return m;
}

export function mesh(geo: THREE.BufferGeometry, material: THREE.Material, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}

/** cylinder between two points */
export function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  g.applyQuaternion(q);
  const c = a.clone().add(b).multiplyScalar(0.5);
  g.translate(c.x, c.y, c.z);
  return g;
}

/** seeded random */
export function rand(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** I-section (steel) along Y, height h, depth d, flange width b */
export function iSection(h: number, d: number, b: number, tf = 0.016, tw = 0.01) {
  return merge([
    place(rbox(b, h, tf, 0.003, 1), 0, 0, d / 2 - tf / 2),
    place(rbox(b, h, tf, 0.003, 1), 0, 0, -d / 2 + tf / 2),
    place(new THREE.BoxGeometry(tw, h, d - 2 * tf), 0, 0, 0),
  ]);
}
