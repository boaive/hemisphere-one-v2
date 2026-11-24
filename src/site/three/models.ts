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
  const plastic = new THREE.MeshPhysicalMaterial({ color: '#45b93b', roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.4 });   // JET's product green
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
  const mat = new THREE.MeshStandardMaterial({ color: '#4b4038', roughness: 0.42, metalness: 0.35 });   // basalt fibre: dark bronze
  const nx = 16, nz = 11, pitch = 0.012;
  const im = new THREE.InstancedMesh(src.geometry, mat, nx * nz);
  const m = new THREE.Matrix4(); let k = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { m.makeTranslation((i - nx / 2) * pitch, 0, (j - nz / 2) * pitch); im.setMatrixAt(k++, m); }
  const g = new THREE.Group(); g.add(im);
  g.rotation.set(0.38, -0.5, 0.08);
  return normalise(g, 2.6);
}

// ---------------------------------------------------------------------------------------------------------
// Packaging, redrawn from the client's product shots (hemisphere-one.com / V1): text, layout and colours only.
// ---------------------------------------------------------------------------------------------------------
const loadImg = (src: string) => { const im = new Image(); im.src = src; return im; };
const logoInk = loadImg('/brand/hemisphere-one-logo-ink.png');
const logoLight = loadImg('/brand/hemisphere-one-logo.png');
const FONT = "'Mona Sans Variable', 'Mona Sans', system-ui, sans-serif";

/** a canvas texture that redraws once the logo images and the brand font are ready */
function labelTexture(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d')!;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const paint = () => { x.clearRect(0, 0, w, h); draw(x); t.needsUpdate = true; };
  paint();
  for (const im of [logoInk, logoLight]) if (!im.complete) im.addEventListener('load', paint, { once: true });
  document.fonts?.ready.then(paint);
  return t;
}
/** set a bold font size so the text fits the given width (never larger than max) */
function fit(x: CanvasRenderingContext2D, text: string, weight: number, max: number, width: number) {
  x.font = `${weight} ${max}px ${FONT}`;
  const w = x.measureText(text).width;
  if (w > width) x.font = `${weight} ${Math.floor(max * (width / w))}px ${FONT}`;
}
const img = (x: CanvasRenderingContext2D, im: HTMLImageElement, px: number, py: number, pw: number) => { if (im.complete && im.naturalWidth) x.drawImage(im, px, py, pw, pw * (im.naturalHeight / im.naturalWidth)); };
function round(x: CanvasRenderingContext2D, px: number, py: number, pw: number, ph: number, r: number) {
  x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + pw, py, px + pw, py + ph, r); x.arcTo(px + pw, py + ph, px, py + ph, r); x.arcTo(px, py + ph, px, py, r); x.arcTo(px, py, px + pw, py, r); x.closePath();
}

/** chemical can label, printed straight on the blue HDPE: logo, name, subtitle, swoosh, checklist, net weight */
export function canLabel(name: string, sub: string, checks: string[]) {
  return labelTexture(600, 820, (x) => {
    const g = x.createLinearGradient(0, 0, 0, 820); g.addColorStop(0, '#2a62c4'); g.addColorStop(1, '#1d4c9f');
    x.fillStyle = g; x.fillRect(0, 0, 600, 820);
    img(x, logoLight, 44, 40, 290);
    x.fillStyle = '#ffffff'; fit(x, name, 800, 118, 520); x.textBaseline = 'alphabetic';
    x.fillText(name, 40, 236);
    x.font = `600 28px ${FONT}`; x.globalAlpha = 0.92; x.fillText(sub, 44, 282); x.globalAlpha = 1;
    x.strokeStyle = '#fcd301'; x.lineWidth = 9; x.lineCap = 'round';
    x.beginPath(); x.moveTo(44, 322); x.bezierCurveTo(200, 300, 380, 346, 556, 310); x.stroke();
    round(x, 36, 360, 528, 330, 22); x.fillStyle = 'rgba(255,255,255,0.96)'; x.fill();
    checks.forEach((c, i) => {
      const y = 418 + i * 64;
      x.fillStyle = '#1d4c9f'; x.beginPath(); x.arc(78, y - 10, 15, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#ffffff'; x.lineWidth = 4; x.beginPath(); x.moveTo(70, y - 10); x.lineTo(76, y - 3); x.lineTo(87, y - 18); x.stroke();
      x.fillStyle = '#1b2633'; x.font = `600 28px ${FONT}`; x.fillText(c, 106, y);
    });
    x.fillStyle = '#ffffff'; x.font = `800 46px ${FONT}`; x.fillText('50 kg Net', 40, 770);
  });
}

/** premix bag face: logo, name, grade line, applications, net weight, coloured base band */
export function bagLabel(name: string, sub: string, apps: string[], band: string) {
  return labelTexture(560, 820, (x) => {
    x.fillStyle = '#f7f6f2'; x.fillRect(0, 0, 560, 820);
    img(x, logoInk, 52, 64, 300);
    x.fillStyle = '#1c2a46'; fit(x, name, 800, 110, 470); x.textBaseline = 'alphabetic';
    x.fillText(name, 46, 250);
    x.fillStyle = '#4b5563'; x.font = `600 28px ${FONT}`; x.fillText(sub, 50, 298);
    x.fillStyle = '#1c2a46'; x.font = `700 26px ${FONT}`; x.fillText('Applications', 50, 372);
    if (apps.length) apps.forEach((a, i) => {
      const y = 418 + i * 50;
      x.fillStyle = '#f4c20d'; round(x, 50, y - 30, 38, 38, 8); x.fill();
      x.fillStyle = '#334155'; x.font = `600 25px ${FONT}`; x.fillText(a, 104, y);
    });
    else for (let i = 0; i < 4; i++) { x.fillStyle = '#f4c20d'; round(x, 50 + i * 82, 396, 66, 66, 10); x.fill(); x.strokeStyle = '#ffffff'; x.lineWidth = 5; x.strokeRect(68 + i * 82, 414, 30, 30); }
    x.fillStyle = '#1c2a46'; x.font = `800 62px ${FONT}`; x.fillText('25 kg', 48, 672);
    x.fillStyle = band; x.fillRect(0, 720, 560, 100);
  });
}

/** a filled sack: rounded volume, fuller in the middle, crimped seams top and bottom */
export function bagGeo(w: number, h: number, d: number) {
  const g = rbox(w, h, d, Math.min(w, d) * 0.3, 8);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = (1 - Math.pow((2 * v.x) / w, 2)) * (1 - Math.pow((2 * v.y) / h, 4));
    v.z *= 1 + 0.42 * Math.max(0, k);
    v.x *= 1 + 0.04 * (1 - Math.pow((2 * v.y) / h, 2));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
/** ENERMIX-25 and TERRAMIX: premix sacks standing, printed face forward */
export function premix() {
  const g = new THREE.Group();
  const W = 0.9, H = 1.36, D = 0.36;
  const geo = bagGeo(W, H, D);
  const specs = [
    { tex: bagLabel('Enermix-25', 'C25 Grade Concrete Dry Mix', [], '#f4c20d'), body: '#f3f2ee', x: -0.52, z: 0.08, ry: 0.2 },
    { tex: bagLabel('Terramix', 'High Performance Concrete HPC', ['RTARIUM thin panels', 'Precast boundary wall'], '#b6babf'), body: '#eceae5', x: 0.52, z: -0.1, ry: -0.2 },
  ];
  for (const sp of specs) {
    const bag = new THREE.Group();
    bag.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: sp.body, roughness: 0.78 })));
    // the print follows the front bulge: a gently curved plane
    const face = new THREE.PlaneGeometry(W * 0.86, H * 0.88, 24, 24);
    const fp = face.attributes.position;
    for (let i = 0; i < fp.count; i++) { const fx = fp.getX(i), fy = fp.getY(i); const k = (1 - Math.pow((2 * fx) / (W * 0.95), 2)) * (1 - Math.pow((2 * fy) / H, 4)); fp.setZ(i, (D / 2) * (1 + 0.42 * Math.max(0, k)) + 0.004); }
    face.computeVertexNormals();
    bag.add(new THREE.Mesh(face, new THREE.MeshStandardMaterial({ map: sp.tex, roughness: 0.72 })));
    for (const sy of [1, -1]) { const seam = new THREE.Mesh(rbox(W * 0.94, 0.05, 0.05, 0.02, 2), new THREE.MeshStandardMaterial({ color: sp.body, roughness: 0.85 })); seam.position.y = sy * (H / 2 - 0.02); bag.add(seam); }
    bag.position.set(sp.x, H / 2, sp.z); bag.rotation.y = sp.ry;
    g.add(bag);
  }
  return normalise(g, 2.35);
}

/** ACTIPOUR and ACTIMIX-PR: blue HDPE jerrycans with red caps; the label is printed on the can face */
export function jerrycanGeo() {
  // body: rounded block, slightly narrower at the shoulders
  const body = rbox(0.82, 1.12, 0.5, 0.1, 6);
  const p = body.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); if (v.y > 0.3) { const k = (v.y - 0.3) / 0.26; v.x *= 1 - 0.06 * k; v.z *= 1 - 0.08 * k; } p.setXYZ(i, v.x, v.y, v.z); }
  body.computeVertexNormals();
  return body;
}
export function admix() {
  const g = new THREE.Group();
  const hdpe = new THREE.MeshPhysicalMaterial({ color: '#2459b8', roughness: 0.36, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const red = new THREE.MeshStandardMaterial({ color: '#d42a22', roughness: 0.4 });
  const body = jerrycanGeo();
  const can = (tex: THREE.Texture, x: number, z: number, ry: number, s: number) => {
    const c = new THREE.Group();
    c.add(new THREE.Mesh(body, hdpe));
    // closed carry handle on the top rear, spout with ribbed red cap on the top front
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 12, 28, Math.PI), hdpe); handle.position.set(-0.1, 0.56, -0.08); c.add(handle);
    const bridge = new THREE.Mesh(rbox(0.42, 0.07, 0.12, 0.03, 2), hdpe); bridge.position.set(-0.1, 0.57, -0.08); c.add(bridge);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.08, 28), hdpe); neck.position.set(0.25, 0.6, 0.06); c.add(neck);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 32), red); cap.position.set(0.25, 0.69, 0.06); c.add(cap);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.98), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.36, clearcoat: 0.35 }));
    lab.position.set(0, -0.03, 0.2505 + 0.001); c.add(lab);
    c.position.set(x, 0.56 * s, z); c.rotation.y = ry; c.scale.setScalar(s);
    g.add(c);
  };
  can(canLabel('Actipour', 'Special Multi-functional Admixture', ['Flow & strength enhancer', 'Cement compatible', 'Low dosage efficiency', 'ASTM / BS certified']), -0.5, 0.05, 0.22, 1);
  can(canLabel('Actimix-PR', 'Synthetic Protein Aerating Agent', ['Improves workability', 'Increased cohesion', 'Added strength', 'ASTM / BS certified']), 0.5, -0.1, -0.24, 0.96);
  return normalise(g, 2.3);
}

/** for the film: a pallet of ENERMIX-25 sacks laid flat, printed face up (two layers, 3 x 2 each) */
export function premixPalletFilm() {
  const g = new THREE.Group();
  const W = 0.46, H = 0.66, D = 0.15;
  const geo = bagGeo(W, H, D);
  const body = new THREE.MeshStandardMaterial({ color: '#f3f2ee', roughness: 0.8 });
  const face = new THREE.MeshStandardMaterial({ map: bagLabel('Enermix-25', 'C25 Grade Concrete Dry Mix', [], '#f4c20d'), roughness: 0.75 });
  const faceGeo = new THREE.PlaneGeometry(W * 0.86, H * 0.86);
  for (let lv = 0; lv < 2; lv++) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const b = new THREE.Group();
    b.add(new THREE.Mesh(geo, body));
    const f = new THREE.Mesh(faceGeo, face); f.position.z = (D / 2) * 1.42 + 0.003; b.add(f);
    b.rotation.set(-Math.PI / 2, 0, (lv + j) % 2 ? Math.PI : 0);
    b.position.set(-0.48 + i * 0.48, 0.2 + lv * 0.2, -0.36 + j * 0.72);
    g.add(b);
  }
  const pallet = new THREE.Mesh(rbox(1.5, 0.12, 1.5, 0.01), new THREE.MeshStandardMaterial({ color: '#c9a77e', roughness: 0.85 }));
  pallet.position.y = 0.06; g.add(pallet);
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return g;
}
/** for the film: ACTIPOUR and ACTIMIX-PR cans at real size (about 0.3 x 0.4 m, 50 kg net) */
export function chemCansFilm() {
  const g = admix();
  g.scale.setScalar(0.5);
  return g;
}
