/**
 * The master film clock. Scroll is the single source of truth: scroll -> target time -> smoothed time t.
 * Everything in the world (camera, construction, characters, text) is a pure function of `film.t`,
 * so scrubbing backwards is exact and deterministic.
 */
export const FILM_DURATION = 58;

export const film = {
  t: 0,            // smoothed film time (s) used for rendering
  target: 0,       // time the scroll position asks for
  velocity: 0,
  playing: false,  // guided playback
  sound: false,
  mobile: false,
  reducedMotion: false,
  ready: false,
};

type Listener = () => void;
const listeners = new Set<Listener>();
export const onFilm = (fn: Listener) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const emitFilm = () => listeners.forEach((fn) => fn());

/** critically-damped follow: silky both directions, no overshoot */
export function stepClock(dt: number) {
  const k = film.reducedMotion ? 60 : 7.5;
  const a = 1 - Math.exp(-k * Math.min(dt, 0.1));
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
