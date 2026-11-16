import { type Key } from './track';

/**
 * THE ONE-TAKE. Every camera key of the film, in world metres (three.js Y-up, journey toward -Z).
 * See docs/PREVIS.md for the shot list. Lens values are full-frame (36 mm gauge) focal lengths.
 */
export type V3 = [number, number, number];

// ------------------------------------------------------------------ world anchors (masterplan)
export const TOWER = { x: 0, z: 0, half: 13, floor: 3.1, floors: 38 };
export const PRECAST = { x: -55, z: -240 };
export const FACTORY = { x0: 25, x1: 65, z0: -400, z1: -550, eave: 12, ridge: 14.5, bay: 7.5 };
export const SITE_ORIGIN: V3 = [10, 0, -800];      // site group, rotated 180 deg (front elevation faces -Z)
/** site-local -> world (site group rotated by PI about Y) */
export const S = (lx: number, ly: number, lz: number): V3 => [SITE_ORIGIN[0] - lx, ly, SITE_ORIGIN[2] - lz];
export const SITE_CENTRE = S(4.5, 0, -7.5);
export const BUILDER_POS: [number, number] = [11.2, 3.4];   // in the open lane: clear sightline to the giants   // site-local x,z of the local builder

const polar = (c: V3, azDeg: number, r: number, h: number): V3 => {
  const a = (azDeg * Math.PI) / 180;
  return [c[0] + r * Math.cos(a), h, c[2] + r * Math.sin(a)];
};

// ------------------------------------------------------------------ dolly zoom (shot 8)
export const DOLLY = {
  t0: 33.0, t1: 37.0,
  subject: S(11.2, 1.5, 3.4),                  // builder chest/head
  dir: (() => { const d = S(11.95, 1.77, 6.3); const s = S(11.2, 1.62, 3.4); const v = [d[0] - s[0], d[1] - s[1], d[2] - s[2]];
    const l = Math.hypot(v[0], v[1], v[2]); return v.map((x) => x / l) as V3; })(),
  head: S(11.2, 1.62, 3.4),
  f0: 40, f1: 65, d0: 3.0,
};

// ------------------------------------------------------------------ camera position keys
export const POS: Key<V3>[] = [
  // 1 - skyscraper arrival: low-angle push-in + technocrane rise
  { t: 0.0, v: [34, 2.0, 44], ease: true },
  { t: 2.0, v: [33, 9.0, 38] },
  { t: 4.0, v: polar([0, 0, 0], 45, 42, 26) },
  // 2 - ascending arc, 120 deg CCW around the active formwork
  { t: 5.3, v: polar([0, 0, 0], 85, 36, 70) },
  { t: 6.6, v: polar([0, 0, 0], 125, 34, 104) },
  { t: 8.0, v: polar([0, 0, 0], 165, 46, 116) },
  // 3 - parallax dolly toward the precast mid-rise, then 84 deg arc L->R across its front
  { t: 9.3, v: [-72, 48, -150] },
  { t: 10.8, v: [-92, 30, -200] },
  { t: 12.1, v: [-30, 24, -207] },
  // 4 - low tracking along the factory bays, then sweeping crane rise
  { t: 13.7, v: [8, 5, -372] },
  { t: 15.5, v: [19.5, 2.4, -418] },
  { t: 16.8, v: [19, 8, -470] },
  { t: 18.6, v: [-30, 80, -480] },
  // 5 - descending crane: over the fringe, arcing round the site to human height
  { t: 20.4, v: polar(SITE_CENTRE, 85, 110, 50) },
  { t: 21.9, v: S(-26, 13, 10.5) },
  { t: 23.0, v: S(-7, 1.6, 6.5) },
  // 6 - ground tracking L->R (plywood shuttering, RC frame)
  { t: 25.5, v: S(-4, 1.6, 6.3) },
  { t: 28.0, v: S(-1, 1.6, 6.0) },
  // 7 - human-scale lateral dolly (brick + plaster)
  { t: 29.0, v: S(0.6, 1.5, 4.4) },
  { t: 31.6, v: S(4.2, 1.52, 4.3) },
  { t: 33.0, v: S(11.95, 1.77, 6.3), ease: true },
  // 8 - dolly zoom is computed analytically (see DOLLY) between 33 and 37
  { t: 37.0, v: [0, 0, 0], ease: true },     // placeholder, replaced at runtime by the dolly end point
  // 9 - curved tracking push-in round the exposed corner (JET transformation)
  { t: 39.5, v: S(0.5, 2.0, 7.2) },
  { t: 42.0, v: S(-2.2, 2.4, 4.6) },
  // 10 - motivated arc to the machinery, revealed past the sand heap / brick stack
  { t: 44.0, v: S(-4.6, 2.5, 4.4) },
  { t: 46.0, v: S(-8.4, 2.3, 2.4) },
  // 11 - continuous lateral tracking along the front wall
  { t: 47.6, v: S(-3.0, 1.7, 5.2) },
  { t: 50.0, v: S(5.2, 1.62, 5.0) },
  // 12 - over-the-shoulder dolly arc to a 3/4 face
  { t: 51.2, v: S(12.3, 1.7, 4.6) },
  { t: 52.7, v: S(12.75, 1.7, 3.5) },
  { t: 54.0, v: S(12.0, 1.66, 2.0), ease: true },
  // 13 - reverse crane pullback to the ecosystem
  { t: 56.0, v: S(13, 26, 44) },
  { t: 58.0, v: S(22, 118, 158), ease: true },
];

// ------------------------------------------------------------------ look-at keys
export const TGT: Key<V3>[] = [
  { t: 0.0, v: [2, 22, 0], ease: true },
  { t: 2.0, v: [1, 45, 0] },
  { t: 4.0, v: [0, 95, 0] },
  { t: 5.3, v: [0, 111, 0] },
  { t: 6.6, v: [-3, 113, 0] },
  { t: 8.0, v: [-52, 40, -240] },
  { t: 9.3, v: [-55, 26, -240] },
  { t: 10.8, v: [-55, 24, -240] },
  { t: 12.1, v: [-52, 24, -244] },
  { t: 13.7, v: [30, 7, -430] },
  { t: 15.5, v: [32, 7, -480] },
  { t: 16.8, v: [40, 9, -520] },
  { t: 18.6, v: [48, 0, -500] },
  { t: 20.4, v: [SITE_CENTRE[0], 2, SITE_CENTRE[2]] },
  { t: 21.9, v: S(-2, 2.5, -3) },
  { t: 23.0, v: S(-4.2, 1.1, -0.2) },
  { t: 25.5, v: S(-2.5, 1.1, -0.1) },
  { t: 28.0, v: S(0.8, 1.1, 0) },
  { t: 29.0, v: S(2.2, 1.0, 0) },
  { t: 31.6, v: S(5.4, 1.1, 0) },
  { t: 33.0, v: DOLLY.subject, ease: true },
  { t: 37.0, v: DOLLY.subject, ease: true },
  { t: 39.5, v: S(-3.0, 1.5, -0.2) },
  { t: 42.0, v: S(-4.2, 1.5, -0.2) },
  { t: 44.0, v: S(-6.9, 1.0, -3.2) },
  { t: 46.0, v: S(-7.2, 1.0, -4.0) },
  { t: 47.6, v: S(0.5, 1.3, 0) },
  { t: 50.0, v: S(5.6, 1.3, 0) },
  { t: 51.2, v: S(5.5, 1.35, -0.4) },
  { t: 52.7, v: S(8.2, 1.45, 1.0) },
  { t: 54.0, v: S(11.2, 1.6, 3.35), ease: true },
  { t: 56.0, v: S(4.5, 2, -7) },
  { t: 58.0, v: S(4.5, 0, -150), ease: true },
];

// ------------------------------------------------------------------ focal length keys (mm)
export const LENS: Key<[number]>[] = [
  { t: 0, v: [24], ease: true }, { t: 4, v: [24] }, { t: 8, v: [33] },
  { t: 9.3, v: [44] }, { t: 12.1, v: [48] },
  { t: 13.7, v: [28] }, { t: 16.8, v: [26] }, { t: 18.6, v: [24] },
  { t: 20.4, v: [35] }, { t: 23, v: [35] }, { t: 28, v: [38] },
  { t: 29, v: [50] }, { t: 33, v: [40], ease: true },
  { t: 37, v: [65], ease: true },
  { t: 39.5, v: [38] }, { t: 42, v: [35] }, { t: 44, v: [42] }, { t: 46, v: [45] },
  { t: 47.6, v: [38] }, { t: 50, v: [38] }, { t: 51.2, v: [50] }, { t: 54, v: [62], ease: true },
  { t: 56, v: [34] }, { t: 58, v: [32], ease: true },
];

/** small controlled bank (deg) only where the move motivates it; never a roll for its own sake */
export const BANK: Key<[number]>[] = [
  { t: 0, v: [0], ease: true }, { t: 6.6, v: [-1.6] }, { t: 10.8, v: [1.2] }, { t: 12.1, v: [0] },
  { t: 18.6, v: [-1.8] }, { t: 21.9, v: [1.4] }, { t: 23, v: [0], ease: true }, { t: 58, v: [0], ease: true },
];

/** chapter windows for UI/grade */
export const SCENES = [
  { id: 's1', label: 'The Apex', from: 0, to: 19 },
  { id: 's2', label: 'The Reality', from: 19, to: 37 },
  { id: 's3', label: 'The Bridge', from: 37, to: 58 },
];
