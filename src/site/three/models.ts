import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildH1 } from '../../world/Machine';
import { rbox, merge, place } from '../../world/geo';
import { concrete } from '../../world/textures';

/**
 * Product models for the live 3D stage. Every builder returns a group normalised to ~2.4 units across,
 * standing on y = 0 and centred on the origin, so the stage can frame them identically.
 */
export function normalise(g: THREE.Object3D, size = 2.4) {
  const box = new THREE.Box3().setFromObject(g);
  const s = size / Math.max(box.max.x - box.min.x, box.max.z - box.min.z, (box.max.y - box.min.y) * 1.15);
  g.scale.multiplyScalar(s);
  const b2 = new THREE.Box3().setFromObject(g), c = b2.getCenter(new THREE.Vector3());
  g.position.x -= c.x; g.position.z -= c.z; g.position.y -= b2.min.y;
  const wrap = new THREE.Group(); wrap.add(g);
  wrap.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return wrap;
}

export function machine() {
  const { group } = buildH1([]);
  group.rotation.y = -0.5;
  return normalise(group, 2.6);
}

function panelGeo(w: number, h: number, depth = 0.06) {
  const parts = [place(rbox(w, h, 0.014, 0.004, 1), 0, h / 2, 0.007)];
  parts.push(place(rbox(w, 0.016, depth, 0.004, 1), 0, 0.008, depth / 2), place(rbox(w, 0.016, depth, 0.004, 1), 0, h - 0.008, depth / 2));
  parts.push(place(rbox(0.016, h, depth, 0.004, 1), -w / 2 + 0.008, h / 2, depth / 2), place(rbox(0.016, h, depth, 0.004, 1), w / 2 - 0.008, h / 2, depth / 2));
  for (let y = 0.15; y < h - 0.05; y += 0.15) parts.push(place(rbox(w - 0.024, 0.009, depth * 0.72, 0.002, 1), 0, y, depth * 0.36));
  for (let x = -w / 2 + 0.15; x < w / 2 - 0.05; x += 0.15) parts.push(place(rbox(0.009, h - 0.024, depth * 0.72, 0.002, 1), x, h / 2, depth * 0.36));
  return merge(parts);
}
/** JET plastic formwork: a wall-form corner in the product's green plastic with dark clamps; two loose panels show the casting face */
export function formwork() {
  const g = new THREE.Group();
  const plastic = new THREE.MeshPhysicalMaterial({ color: '#3a9e46', roughness: 0.38, clearcoat: 0.4, clearcoatRoughness: 0.35 });
  const clip = new THREE.MeshStandardMaterial({ color: '#23272b', roughness: 0.5, metalness: 0.15 });
  const geo = panelGeo(0.6, 1.2);
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(geo, plastic); m.position.set(-0.9 + i * 0.6 + 0.3, r * 1.2, 0); g.add(m); }
    for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(geo, plastic); m.position.set(0.9, r * 1.2, -0.3 - i * 0.6); m.rotation.y = Math.PI / 2; g.add(m); }
  }
  for (let r = 0; r < 2; r++) for (let i = 1; i < 3; i++) for (const y of [0.3, 0.9]) {
    const c = new THREE.Mesh(rbox(0.032, 0.1, 0.075, 0.008, 2), clip); c.position.set(-0.9 + i * 0.6, r * 1.2 + y, 0.06); g.add(c);
  }
  for (const [x, z, ry] of [[-1.35, 0.85, Math.PI + 0.42], [-0.95, 1.12, Math.PI + 0.7]] as const) {
    const m = new THREE.Mesh(geo, plastic); m.position.set(x, 0, z); m.rotation.set(-0.15, ry, 0); g.add(m);
  }
  g.rotation.y = -0.55;
  return normalise(g, 2.5);
}

let rtP: Promise<{ scene: THREE.Group }> | null = null;
/** RTARIUM: the client's production cell geometry, tiled into a patch (12 mm pitch) */
export async function rtarium() {
  const gltf = await (rtP ??= new GLTFLoader().loadAsync('/models/rtarium-cell-t10.glb'));
  const src = (gltf.scene.getObjectByName('RTARIUM_cell_t10_lo') ?? gltf.scene.getObjectByName('RTARIUM_cell_t10_hi')) as THREE.Mesh;
  const mat = new THREE.MeshStandardMaterial({ color: '#a8957a', roughness: 0.36, metalness: 0.3 });
  const nx = 16, nz = 11, pitch = 0.012;
  const im = new THREE.InstancedMesh(src.geometry, mat, nx * nz);
  const m = new THREE.Matrix4(); let k = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { m.makeTranslation((i - nx / 2) * pitch, 0, (j - nz / 2) * pitch); im.setMatrixAt(k++, m); }
  const g = new THREE.Group(); g.add(im);
  g.rotation.set(0.38, -0.5, 0.08);
  return normalise(g, 2.6);
}

/** canvas label: white field, brand-yellow band, the Hemisphere One logo and the product name (nothing else) */
const logoImg = (() => { const im = new Image(); im.src = '/brand/hemisphere-one-logo-ink.png'; return im; })();
function packLabel(name: string, opts: { w: number; h: number; band: boolean; ground: string }) {
  const c = document.createElement('canvas'); c.width = opts.w; c.height = opts.h;
  const x = c.getContext('2d')!;
  const draw = () => {
    x.clearRect(0, 0, c.width, c.height);
    x.fillStyle = opts.ground; x.fillRect(0, 0, c.width, c.height);
    if (opts.band) { x.fillStyle = '#fcd301'; x.fillRect(0, c.height * 0.58, c.width, c.height * 0.2); }
    const lw = c.width * 0.62, lh = lw * (87 / 460);
    if (logoImg.complete && logoImg.naturalWidth) x.drawImage(logoImg, (c.width - lw) / 2, c.height * 0.16, lw, lh);
    x.fillStyle = '#16191c'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `700 ${Math.round(c.width * 0.1)}px 'Mona Sans Variable', 'Mona Sans', sans-serif`;
    x.fillText(name, c.width / 2, opts.band ? c.height * 0.68 : c.height * 0.62);
  };
  draw();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (!logoImg.complete) logoImg.addEventListener('load', () => { draw(); t.needsUpdate = true; }, { once: true });
  return t;
}

/** a filled woven bag: soft pillow volume (rounded box, gently bulged) */
function bagGeo(w: number, h: number, d: number) {
  const g = rbox(w, h, d, Math.min(w, d) * 0.22, 6);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = (1 - Math.pow((2 * v.x) / w, 2)) * (1 - Math.pow((2 * v.y) / h, 2));
    v.z *= 1 + 0.22 * Math.max(0, k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
/** ENERMIX and TERRAMIX: premix bags standing, printed face forward: white, brand-yellow band, logo and product name */
export function premix() {
  const g = new THREE.Group();
  const woven = new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.82 });
  const W = 0.86, H = 1.22, D = 0.3;
  const geo = bagGeo(W, H, D);
  const specs = [
    { name: 'ENERMIX-25', x: -0.5, z: 0.05, ry: 0.22 },
    { name: 'TERRAMIX', x: 0.5, z: -0.08, ry: -0.18 },
  ];
  for (const sp of specs) {
    const bag = new THREE.Group();
    bag.add(new THREE.Mesh(geo, woven));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.84, H * 0.84), new THREE.MeshStandardMaterial({ map: packLabel(sp.name, { w: 360, h: 512, band: true, ground: '#f6f4ef' }), roughness: 0.78 }));
    face.position.z = (D / 2) * 1.22 + 0.004; bag.add(face);
    // folded top seam
    const seam = new THREE.Mesh(rbox(W * 0.92, 0.05, 0.06, 0.02, 2), woven); seam.position.y = H / 2 - 0.01; bag.add(seam);
    bag.position.set(sp.x, H / 2, sp.z); bag.rotation.y = sp.ry;
    g.add(bag);
  }
  return normalise(g, 2.3);
}

/** ACTIPOUR and ACTIMIX: chemical cans in blue HDPE with red caps, logo and product name on the label */
export function admix() {
  const g = new THREE.Group();
  const hdpe = new THREE.MeshPhysicalMaterial({ color: '#1f56a8', roughness: 0.34, clearcoat: 0.3, clearcoatRoughness: 0.45 });
  const red = new THREE.MeshStandardMaterial({ color: '#d0261e', roughness: 0.42 });
  const can = (name: string, x: number, z: number, ry: number, s: number) => {
    const c = new THREE.Group();
    c.add(new THREE.Mesh(rbox(0.78, 1.08, 0.5, 0.09, 4), hdpe));
    // carry handle along the top, spout with a red screw cap at the front corner
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.045, 10, 24, Math.PI), hdpe); handle.position.set(-0.08, 0.54, 0); c.add(handle);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.08, 24), hdpe); neck.position.set(0.26, 0.58, 0); c.add(neck);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.09, 28), red); cap.position.set(0.26, 0.66, 0); c.add(cap);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.56), new THREE.MeshStandardMaterial({ map: packLabel(name, { w: 400, h: 373, band: false, ground: '#ffffff' }), roughness: 0.6 }));
    lab.position.set(0, -0.06, 0.252); c.add(lab);
    c.position.set(x, 0.54 * s, z); c.rotation.y = ry; c.scale.setScalar(s);
    g.add(c);
  };
  can('ACTIPOUR', -0.48, 0.05, 0.22, 1);
  can('ACTIMIX-PR', 0.5, -0.1, -0.26, 0.92);
  return normalise(g, 2.3);
}
