import { type SceneId } from './clock';

/**
 * Per-film look. Scene 1: bright, clean precision-model daylight with blue data rings; the live site in full colour.
 * Scene 2: warm late-afternoon sun, realistic. Scene 3: the same site, light clears slightly as the
 * technology arrives. One believable sun per film.
 */
export type Look = {
  sun: { az: number; el: number; color: string; intensity: number; soft: number };   // degrees; soft = disc jitter (deg)
  fill: { sky: string; ground: string; intensity: number };
  sky: { kind: 'gradient'; zenith: string; horizon: string; glow: string; intensity: number } | { kind: 'physical'; turbidity: number; rayleigh: number; mie: number; g: number; exposure: number };
  fog: { color: string; density: number };
  env: number;                    // image-based light intensity
  tone: 'neutral' | 'agx';        // display transform
  grade: { exposure: number; warm: number; tint: number; contrast: number; sat: number; lift: number; vignette: number };
};

export const LOOKS: Record<SceneId, Look> = {
  1: {
    sun: { az: 128, el: 36, color: '#fff3e4', intensity: 3.4, soft: 1.0 },
    fill: { sky: '#dfe9f4', ground: '#cfcac0', intensity: 0.5 },
    sky: { kind: 'gradient', zenith: '#86b0d9', horizon: '#e6edf2', glow: '#fff6ea', intensity: 0.95 },
    fog: { color: '#dfe7ee', density: 0.00042 },
    env: 0.7, tone: 'neutral',
    grade: { exposure: 1.0, warm: -0.005, tint: 0, contrast: 1.09, sat: 1.04, lift: 0.0, vignette: 0.08 },
  },
  2: {
    sun: { az: 305, el: 19, color: '#ffd29a', intensity: 3.6, soft: 0.7 },
    fill: { sky: '#b9cde0', ground: '#8f6e50', intensity: 0.42 },
    sky: { kind: 'physical', turbidity: 7.5, rayleigh: 2.2, mie: 0.0055, g: 0.82, exposure: 0.55 },
    fog: { color: '#e9d4b4', density: 0.0006 },
    env: 0.75, tone: 'agx',
    grade: { exposure: 1.0, warm: 0.075, tint: 0.006, contrast: 1.04, sat: 1.04, lift: 0.01, vignette: 0.16 },
  },
  3: {
    sun: { az: 305, el: 21, color: '#ffdcae', intensity: 3.5, soft: 0.7 },
    fill: { sky: '#c3d6e6', ground: '#8f6e50', intensity: 0.46 },
    sky: { kind: 'physical', turbidity: 6.5, rayleigh: 2.0, mie: 0.005, g: 0.82, exposure: 0.55 },
    fog: { color: '#e7d8bf', density: 0.00055 },
    env: 0.8, tone: 'agx',
    grade: { exposure: 1.02, warm: 0.05, tint: 0.003, contrast: 1.05, sat: 1.03, lift: 0.01, vignette: 0.14 },
  },
};

/** Scene 3, second half (from the builder shot): the site has changed, and so has the light. Clear, high
 *  modern daylight in place of the dusty golden hour. */
export const LOOK_3B: Look = {
  sun: { az: 340, el: 40, color: '#fff5e8', intensity: 3.6, soft: 0.8 },   // a three-quarter key on the builder; the house shadow falls away from the yard
  fill: { sky: '#cfe0f0', ground: '#bdb6aa', intensity: 0.5 },
  sky: { kind: 'physical', turbidity: 2.2, rayleigh: 2.0, mie: 0.003, g: 0.8, exposure: 0.55 },
  fog: { color: '#d6e1ea', density: 0.00048 },
  env: 0.85, tone: 'agx',
  grade: { exposure: 1.06, warm: 0.0, tint: 0, contrast: 1.08, sat: 1.06, lift: 0.0, vignette: 0.1 },
};
/** the look in force right now (Scene 3 switches on the cut into the builder shot) */
export function activeLook(scene: SceneId, story: number): { key: string; look: Look } {
  if (scene === 3 && story >= 49.95) return { key: '3b', look: LOOK_3B };
  return { key: String(scene), look: LOOKS[scene] };
}

/** unit vector toward the sun */
export function sunDir(look: Look, out: { x: number; y: number; z: number }, jitterX = 0, jitterY = 0) {
  const az = ((look.sun.az + jitterX * look.sun.soft) * Math.PI) / 180;
  const el = ((look.sun.el + jitterY * look.sun.soft) * Math.PI) / 180;
  out.x = Math.cos(el) * Math.cos(az);
  out.y = Math.sin(el);
  out.z = Math.cos(el) * Math.sin(az);
  return out;
}
