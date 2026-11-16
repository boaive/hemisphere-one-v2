import * as THREE from 'three';

/**
 * Procedural PBR maps, generated once at load on a canvas (no texture downloads).
 * Each generator returns tileable maps: albedo (sRGB), roughness (linear) and a normal map derived from height.
 */
// ------------------------------------------------------------------ seeded value noise (tileable)
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function makeNoise(seed: number, period: number) {
  const r = rng(seed);
  const g = new Float32Array(period * period).map(() => r());
  const at = (x: number, y: number) => g[((y % period + period) % period) * period + ((x % period + period) % period)];
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
/** tileable fBm in [0,1] over a size x size texture with base frequency `f` cells */
function fbm(size: number, f: number, oct: number, seed: number, sx = 1, sy = 1) {
  const out = new Float32Array(size * size);
  let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const p = f * (1 << o);
    const n = makeNoise(seed + o * 97, p);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      out[y * size + x] += amp * n((x / size) * p * sx, (y / size) * p * sy);
    }
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

function canvasTex(size: number, draw: (img: ImageData) => void, srgb: boolean, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  draw(img);
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  return t;
}

function normalFromHeight(h: Float32Array, size: number, strength: number) {
  return canvasTex(size, (img) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
      const u = h[((y - 1 + size) % size) * size + x], d = h[((y + 1) % size) * size + x];
      let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = nz * 255; img.data[i + 3] = 255;
    }
  }, false);
}

function grey(h: Float32Array, size: number, map: (v: number, i: number) => [number, number, number], srgb = true) {
  return canvasTex(size, (img) => {
    for (let i = 0; i < size * size; i++) {
      const [r, g, b] = map(h[i], i);
      img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
    }
  }, srgb);
}

export type PBR = { map: THREE.Texture; roughnessMap: THREE.Texture; normalMap: THREE.Texture };
const cache = new Map<string, PBR>();
const S = 512;

/** cast concrete: soft cloudy grey variation, fine pitting, optional Aluform tie-hole + panel-joint grid */
export function concrete(seed = 3, ties = false): PBR {
  const key = `concrete${seed}${ties}`;
  if (cache.has(key)) return cache.get(key)!;
  const cloud = fbm(S, 4, 5, seed);
  const pit = fbm(S, 64, 2, seed + 11);
  const h = new Float32Array(S * S);
  const tie = (x: number, y: number) => {
    if (!ties) return 0;
    // 600 x 2400 panel joints and tie holes on a 600 x 900 grid, mapped to a 1.2 m tile
    const u = x / S, v = y / S;
    const jx = Math.min(Math.abs((u * 2) % 1), 1 - Math.abs((u * 2) % 1));
    const ty = (v * 1.333) % 1, tx = (u * 2) % 1;
    const d = Math.hypot(tx - 0.5, (ty - 0.5) * 0.66);
    return (jx < 0.006 ? 0.5 : 0) + (d < 0.018 ? 1 : 0);
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    h[i] = 0.85 * cloud[i] + 0.15 * (pit[i] > 0.86 ? 0 : 1) - 0.6 * tie(x, y);
  }
  const res: PBR = {
    map: grey(cloud, S, (v, i) => { const t = tie(i % S, (i / S) | 0); const g = 150 + 50 * (v - 0.5) - (pit[i] > 0.86 ? 10 : 0) - t * 60; return [g * 1.0, g * 0.985, g * 0.95]; }),
    roughnessMap: grey(pit, S, (v) => { const g = 200 + 40 * (v - 0.5); return [g, g, g]; }, false),
    normalMap: normalFromHeight(h, S, 1.0),
  };
  cache.set(key, res); return res;
}

/** weathered plywood: stretched grain, darker edges/stains, cement slurry splashes */
export function plywood(seed = 5): PBR {
  const key = `ply${seed}`; if (cache.has(key)) return cache.get(key)!;
  const grain = fbm(S, 2, 6, seed, 1, 14);
  const stain = fbm(S, 3, 5, seed + 3);
  const slurry = fbm(S, 6, 4, seed + 9);
  const res: PBR = {
    map: grey(grain, S, (v, i) => {
      const st = Math.max(0, stain[i] - 0.5) * 1.6; const sl = slurry[i] > 0.66 ? 1 : 0;
      let r = 150 + 70 * (v - 0.5), g = 116 + 55 * (v - 0.5), b = 78 + 35 * (v - 0.5);
      r *= 1 - st * 0.5; g *= 1 - st * 0.5; b *= 1 - st * 0.45;
      if (sl) { r = r * 0.35 + 160 * 0.65; g = g * 0.35 + 156 * 0.65; b = b * 0.35 + 146 * 0.65; }
      return [r, g, b];
    }),
    roughnessMap: grey(slurry, S, (v) => { const g = v > 0.66 ? 235 : 205; return [g, g, g]; }, false),
    normalMap: normalFromHeight(grain, S, 1.4),
  };
  cache.set(key, res); return res;
}

/** brushed aluminium: anisotropic-looking streaks via stretched noise in roughness + normal */
export function brushed(seed = 7): PBR {
  const key = `alu${seed}`; if (cache.has(key)) return cache.get(key)!;
  const streak = fbm(S, 2, 6, seed, 40, 1);
  const smudge = fbm(S, 3, 4, seed + 5);
  const res: PBR = {
    map: grey(streak, S, (v, i) => { const g = 196 + 18 * (v - 0.5) - 14 * Math.max(0, smudge[i] - 0.6); return [g, g * 1.01, g * 1.03]; }),
    roughnessMap: grey(streak, S, (v, i) => { const g = 82 + 40 * (v - 0.5) + 50 * Math.max(0, smudge[i] - 0.6); return [g, g, g]; }, false),
    normalMap: normalFromHeight(streak, S, 0.6),
  };
  cache.set(key, res); return res;
}

/** trapezoidal-profile insulated metal panel (ribs every 1/4 of the tile) */
export function ribbedPanel(): PBR {
  const key = 'rib'; if (cache.has(key)) return cache.get(key)!;
  const h = new Float32Array(S * S);
  const n = fbm(S, 8, 3, 21);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x / S * 4) % 1; const rib = u < 0.12 ? 1 : u < 0.18 ? 1 - (u - 0.12) / 0.06 : u > 0.94 ? (u - 0.94) / 0.06 : 0;
    h[y * S + x] = rib + 0.02 * n[y * S + x];
  }
  const res: PBR = {
    map: grey(h, S, (v) => { const g = 214 - v * 10; return [g, g * 1.005, g * 1.015]; }),
    roughnessMap: grey(n, S, (v) => { const g = 110 + 30 * v; return [g, g, g]; }, false),
    normalMap: normalFromHeight(h, S, 5),
  };
  cache.set(key, res); return res;
}

/** red laterite earth with gravel; and a dusty concrete-grey variant for paved areas */
export function earth(seed = 13, paved = false): PBR {
  const key = `earth${seed}${paved}`; if (cache.has(key)) return cache.get(key)!;
  const big = fbm(S, 3, 5, seed);
  const grit = fbm(S, 48, 2, seed + 7);
  const h = new Float32Array(S * S);
  for (let i = 0; i < h.length; i++) h[i] = big[i] * 0.6 + grit[i] * 0.4;
  const res: PBR = {
    map: grey(big, S, (v, i) => {
      const gr = (grit[i] - 0.5) * 14;
      return paved ? [122 + 40 * (v - 0.5) + gr, 120 + 38 * (v - 0.5) + gr, 114 + 34 * (v - 0.5) + gr]
                   : [150 + 50 * (v - 0.5) + gr, 100 + 35 * (v - 0.5) + gr, 72 + 25 * (v - 0.5) + gr];
    }),
    roughnessMap: grey(grit, S, (v) => { const g = 228 + 20 * (v - 0.5); return [g, g, g]; }, false),
    normalMap: normalFromHeight(h, S, 0.9),
  };
  cache.set(key, res); return res;
}

/** glazed facade (curtain wall): mullion grid + subtle per-pane variation; used as emissive-free map on glass */
export function curtainWall(lit = 0): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const r = rng(lit + 3);
  g.fillStyle = '#1d2a35'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) {
    const v = 26 + r() * 22;
    g.fillStyle = `rgb(${v * 0.8},${v},${v * 1.18})`;
    g.fillRect(x * 32 + 2, y * 64 + 4, 28, 56);
  }
  g.fillStyle = '#8f9aa3';
  for (let y = 0; y < 4; y++) g.fillRect(0, y * 64, 256, 4);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** generic city facade for background towers: floor bands + windows, some lit (for emissive) */
export function cityFacade(seed: number): { map: THREE.Texture; emissive: THREE.Texture } {
  const mk = (emissive: boolean) => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const g = c.getContext('2d')!; const r = rng(seed);
    g.fillStyle = emissive ? '#000' : '#7d8790'; g.fillRect(0, 0, 128, 256);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 8; x++) {
      const on = r();
      if (emissive) { g.fillStyle = on > 0.93 ? '#3a3226' : '#000'; }
      else { const v = 40 + r() * 30; g.fillStyle = `rgb(${v * 0.85},${v},${v * 1.15})`; }
      g.fillRect(x * 16 + 2, y * 8 + 2, 12, 5);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  };
  return { map: mk(false), emissive: mk(true) };
}

/** semi-urban house facade: painted wall, grime streaks, windows with grilles / shutters */
export function houseFacade(seed: number): THREE.Texture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d')!; const r = rng(seed);
  const n = fbm(64, 4, 4, seed);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = 228 - 40 * n[y * 64 + x] - (y > 50 ? 20 : 0);
    g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x * 4, y * 4, 4, 4);
  }
  // rain streaks under sills
  for (let k = 0; k < 2; k++) for (let x = 0; x < 2; x++) {
    const wx = 40 + x * 120, wy = 40 + k * 128;
    g.fillStyle = '#2a2b2c'; g.fillRect(wx, wy, 56, 62);
    g.fillStyle = r() > 0.5 ? '#3d5a73' : '#6b6e70'; g.fillRect(wx + 4, wy + 4, 48, 54);
    g.strokeStyle = '#1b1b1b'; g.lineWidth = 2;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(wx + i * 14, wy + 4); g.lineTo(wx + i * 14, wy + 58); g.stroke(); }
    const grad = g.createLinearGradient(0, wy + 62, 0, wy + 120);
    grad.addColorStop(0, 'rgba(60,55,50,.35)'); grad.addColorStop(1, 'rgba(60,55,50,0)');
    g.fillStyle = grad; g.fillRect(wx + 6, wy + 62, 44, 58);
    g.fillStyle = '#bdb6aa'; g.fillRect(wx - 6, wy + 60, 68, 6);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

/** lattice (crane masts/jibs): alpha mask with diagonal bracing */
export function lattice(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#fff'; g.lineWidth = 5;
  g.strokeRect(2, -4, 60, 72);
  g.lineWidth = 3; g.beginPath(); g.moveTo(2, 64); g.lineTo(62, 0); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.moveTo(0, 2); g.lineTo(64, 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

export function withRepeat(p: PBR, rx: number, ry = rx): PBR {
  const c = (t: THREE.Texture) => { const n = t.clone(); n.needsUpdate = true; n.repeat.set(rx, ry); return n; };
  return { map: c(p.map), roughnessMap: c(p.roughnessMap), normalMap: c(p.normalMap) };
}
