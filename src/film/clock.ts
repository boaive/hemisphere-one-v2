/**
 * The film clock. The homepage plays three separate, pre-rendered films; this clock drives the 3D world while
 * those films are rendered offline (or previewed in dev).
 *
 * - `film.scene`  which film is being rendered (1, 2 or 3)
 * - `film.t`      seconds into that film (real time: camera, people, machines)
 * - `film.story`  construction time: a per-scene warp of `film.t` so every build event lands inside the shot
 *                 that shows it (see `storyTime` in shots.ts). Everything in the world is a pure function of
 *                 these values, so any frame can be rendered in any order.
 */
export type SceneId = 1 | 2 | 3;

export const film = {
  scene: 1 as SceneId,
  t: 0,
  story: 0,
  target: 0,
  velocity: 0,
  portrait: false,       // portrait framing (phone cut of each film)
  mobile: false,
  reducedMotion: false,
  render: false,         // offline render: no smoothing, deterministic
  ready: false,
  playing: false,
  sound: false,
  /** current sub-frame sample (offline accumulation): pixel jitter (px), lens aperture offset (m), sun disc offset */
  sub: { jx: 0, jy: 0, ax: 0, ay: 0, sx: 0, sy: 0 },
};

type Listener = () => void;
const listeners = new Set<Listener>();
export const onFilm = (fn: Listener) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const emitFilm = () => listeners.forEach((fn) => fn());

/** dev preview only: critically-damped follow toward `target` (offline renders set `t` directly) */
export function stepClock(dt: number) {
  if (film.render) return;
  const a = 1 - Math.exp(-9 * Math.min(dt, 0.1));
  const prev = film.t;
  film.t += (film.target - film.t) * a;
  if (Math.abs(film.target - film.t) < 1e-4) film.t = film.target;
  film.velocity = (film.t - prev) / Math.max(dt, 1e-4);
}

// ------------------------------------------------------------------ timing helpers (pure)
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** 0..1 progress of t through [a,b] */
export const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const smooth = (u: number) => u * u * (3 - 2 * u);
export const smoother = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);
/** settle: arrives fast, eases in the last 30% - for parts seating into place (no bounce) */
export const seat = (u: number) => 1 - Math.pow(1 - clamp01(u), 3);
export const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
/** staggered progress for item i of n inside [a,b], each item taking `dur` of the window (0..1) */
export function stagger(t: number, a: number, b: number, i: number, n: number, dur = 0.35) {
  const u = span(t, a, b);
  const start = n <= 1 ? 0 : (i / (n - 1)) * (1 - dur);
  return clamp01((u - start) / dur);
}
/** piecewise-linear map through [x, y] pairs (x ascending); used for time warps */
export function pw(x: number, pts: [number, number][]) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    if (x <= x1) { const [x0, y0] = pts[i - 1]; return x1 === x0 ? y1 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0); }
  }
  return pts[pts.length - 1][1];
}
