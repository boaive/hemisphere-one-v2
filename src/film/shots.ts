import { type Key } from './track';
import { type SceneId, pw } from './clock';

/**
 * Masterplan + shot lists for the three films. World metres, three.js Y-up.
 * Each film is a sequence of shots joined by hard cuts (standard film grammar); one camera move per shot,
 * cut on motion. Lens values are full-frame (36 mm gauge) focal lengths.
 */
export type V3 = [number, number, number];

// ------------------------------------------------------------------ masterplan
/** Scene 1: one compact district holding the three flagship projects (so one aerial frame can hold them all) */
export const TOWER = { x: 0, z: 0, half: 11, floor: 3.1, floors: 22 };
export const PRECAST = { x: -50, z: 24 };
export const FACTORY = { x0: 62, x1: 102, z0: -34, z1: -184, eave: 12, ridge: 14.5, bay: 7.5 };
export const DISTRICT: V3 = [6, 0, -72];
/** Film 01's controlled environment: one organised campus holding the three zones */
export const CAMPUS = { x0: -200, x1: 210, z0: 100, z1: -180 };
export const DATACENTER = { x: 60, z: -4, w: 60, d: 36 };
/** Scenes 2-3: the everyday site on the semi-urban fringe, ~0.9 km from the district (its skyline sits behind the house) */
export const SITE_ORIGIN: V3 = [10, 0, -900];
/** site-local -> world (site group rotated by PI about Y; the house front faces away from the district) */
export const S = (lx: number, ly: number, lz: number): V3 => [SITE_ORIGIN[0] - lx, ly, SITE_ORIGIN[2] - lz];
export const SITE_CENTRE = S(4.5, 0, -7.5);
export const BUILDER_POS: [number, number] = [12.0, 6.2];
/** film 3 finale: everyday plots (world offsets from the site centre) where the bridge lands and a modern site builds */
export const NODES: { dx: number; dz: number; kind: 'jet' | 'precast' | 'panel'; ry: number; label?: string }[] = [
  { dx: -78, dz: 72, kind: 'jet', ry: 0.3 },
  { dx: 72, dz: 112, kind: 'precast', ry: -0.4 },
  { dx: -168, dz: 168, kind: 'panel', ry: 0.2 },
  { dx: 160, dz: 58, kind: 'jet', ry: -0.2 },
  { dx: -36, dz: 232, kind: 'precast', ry: 0.5 },
  { dx: 132, dz: 252, kind: 'panel', ry: -0.3 },
  { dx: -232, dz: 52, kind: 'precast', ry: 0.1 },
  { dx: 240, dz: 186, kind: 'jet', ry: 0.4 },
];

const polar = (c: V3, azDeg: number, r: number, h: number): V3 => {
  const a = (azDeg * Math.PI) / 180;
  return [c[0] + r * Math.cos(a), h, c[2] + r * Math.sin(a)];
};
/** keys along a circular arc (enough samples that the spline reads as a true orbit) */
function orbit(c: V3, az0: number, az1: number, r0: number, r1: number, h0: number, h1: number, dur: number, n = 6, easeIn = false, easeOut = false): Key<V3>[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n;
    return { t: u * dur, v: polar(c, az0 + (az1 - az0) * u, r0 + (r1 - r0) * u, h0 + (h1 - h0) * u), ease: (i === 0 && easeIn) || (i === n && easeOut) || undefined };
  });
}
const line = (a: V3, b: V3, dur: number, easeIn = false, easeOut = false): Key<V3>[] => [{ t: 0, v: a, ease: easeIn || undefined }, { t: dur, v: b, ease: easeOut || undefined }];
const lens = (a: number, b = a, dur = 1): Key<[number]>[] => [{ t: 0, v: [a] }, { t: dur, v: [b] }];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export type Shot = {
  id: string;
  dur: number;
  pos: Key<V3>[];
  tgt: Key<V3>[];
  lens: Key<[number]>[];
  roll?: Key<[number]>[];
  /** depth of field (offline accumulation): focus distance in metres or 'target'; f-number (full frame) */
  focus?: number | 'target';
  fstop?: number;
  /** phone cut: pull back along the view axis, scale the focal length, raise the camera, re-aim or re-frame */
  portrait?: { pull?: number; lens?: number; lift?: number; tgt?: V3; shift?: [number, number] };
  /** off-axis framing (NDC): negative x moves the picture right, negative y moves it up (keeps room for copy) */
  shift?: [number, number];
  /** scale of the shot, used for clip planes, shadow frustum and AO radius */
  scale: 'city' | 'site' | 'human';
  /** share of the camera pitch replaced by lens shift (1 = verticals perfectly parallel) */
  level?: number;
  /** 'slerp': rotate the aim evenly between the first and last aim (smooth tilts between far and near subjects) */
  aim?: 'slerp';
};

// ------------------------------------------------------------------ SCENE 1 - The Apex of Modern Construction
/** a point at distance d from target t along azimuth az / elevation el (degrees) */
const axis = (t: V3, az: number, el: number, d: number): V3 => {
  const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
  return [t[0] + d * Math.cos(e) * Math.cos(a), t[1] + d * Math.sin(e), t[2] + d * Math.cos(e) * Math.sin(a)];
};
/** pure truck: camera and target slide by the same vector (no rotation, no zoom) */
const truck = (pos: V3, tgt: V3, by: V3, dur: number) => ({ pos: line(pos, add(pos, by), dur, true, true), tgt: line(tgt, add(tgt, by), dur, true, true) });

/*
 * Scene 1 grammar: one subject and one slow, eased move per shot (premium pacing), subject held right of centre so
 * the copy owns the left third. Aluform -> Precast -> Panelized, then one long pull-back on a fixed axis that
 * reveals the whole controlled environment. No orbits, no combined pan + push, no handheld drift.
 */
const AL_T: V3 = [-6.4, 53.5, 8.2];                 // aim point: the tower top sits on the right third
const PC_T: V3 = [PRECAST.x - 2, 21, PRECAST.z + 4];        // the hero slot, seen from below
const DC_T: V3 = [DATACENTER.x + 10, 5, DATACENTER.z + 10];
const END_T: V3 = [-2, 4, -48];
const S1: Shot[] = [
  {
    // Aluform: a slow push-in on the climbing top floors (forms going up, deck assembling, crew at work)
    id: 'aluform', dur: 4.6, scale: 'city', level: 0.85,
    pos: line(axis(AL_T, 38, 9, 66), axis(AL_T, 38, 9, 53), 4.6, true, true),
    tgt: line(AL_T, AL_T, 4.6),
    lens: lens(32), portrait: { pull: 1.35, lens: 0.88 },
  },
  {
    // Volumetric precast: a low three-quarter view looking up at the slot; slow truck right as the module is set
    id: 'precast', dur: 4.4, scale: 'city', level: 0.9,
    ...truck(axis(PC_T, 62, -6, 56), PC_T, [4.4, 0, -2.35], 4.4),
    lens: lens(30), portrait: { pull: 1.3, lens: 0.88 },
  },
  {
    // Panelized: a low oblique view down the dock wall (ribbed panels raking in the light); the crane sets the
    // last panel. Slow truck right
    id: 'panelized', dur: 4.4, scale: 'city', level: 0.9,
    ...truck(axis(DC_T, 140, 7, 70), DC_T, [3.4, 0, 4.1], 4.4),
    lens: lens(32), portrait: { pull: 1.3, lens: 0.88, shift: [0, 0.2] },
  },
  {
    // one long pull-back on a fixed axis: from the three systems to the whole controlled environment
    id: 'apex', dur: 5.6, scale: 'city', level: 0.5,
    pos: line(axis(END_T, 62, 17.5, 250), axis(END_T, 62, 17.5, 560), 5.6, true, true),
    tgt: line(END_T, END_T, 5.6),
    lens: lens(32), shift: [-0.1, -0.02], portrait: { pull: 1.35, lens: 0.9, shift: [0, 0.16] },
  },
];

// ------------------------------------------------------------------ SCENE 2 - The Reality on the Ground
const S2: Shot[] = [
  {
    // from the giants' skyline, a slow crane-down onto the everyday site (one continuous tilt)
    id: 'skyline', dur: 4.6, scale: 'site', aim: 'slerp', level: 0.6,
    pos: line(S(4.6, 15, 36), S(4.5, 9, 29), 4.6, true, true),
    tgt: [{ t: 0, v: [2, 52, 0] }, { t: 4.6, v: S(4.5, 2.4, -5) }],
    lens: lens(45), portrait: { pull: 1.2, lens: 0.85 },
  },
  {
    // plywood shuttering on the extension column: a medium shot at eye level, slow drift left
    id: 'plywood', dur: 3.8, scale: 'human',
    pos: line(S(1.6, 1.7, 6.0), S(0.6, 1.7, 5.7), 3.8, true, true),
    tgt: line(S(-4.0, 1.4, 0), S(-4.4, 1.4, 0), 3.8, true, true),
    lens: lens(32), focus: 'target', fstop: 5.6, portrait: { pull: 1.25, lens: 0.85 },
  },
  {
    // the bare RC frame from the yard corner, looking up (static-feeling, a few centimetres of rise)
    id: 'rc-frame', dur: 3.3, scale: 'human',
    pos: line(S(13.4, 1.4, 9.6), S(12.6, 1.6, 9.9), 3.3, true, true),
    tgt: line(S(5.4, 4.3, -4.6), S(5.2, 4.4, -4.6), 3.3, true, true),
    lens: lens(28), portrait: { pull: 1.2, lens: 0.85 },
  },
  {
    // brickwork and plaster: a slow lateral dolly along the wall at a comfortable distance
    id: 'brickwork', dur: 3.8, scale: 'human',
    pos: line(S(0.6, 1.7, 8.6), S(3.4, 1.7, 8.5), 3.8, true, true),
    tgt: line(S(2.2, 1.3, 0), S(5.0, 1.3, 0), 3.8, true, true),
    lens: lens(35), focus: 'target', fstop: 5.6, portrait: { pull: 1.2, lens: 0.85 },
  },
  {
    // the whole site, then up to the neighbourhood: this is how most of the country builds
    id: 'reality', dur: 4.0, scale: 'site',
    pos: line(S(4.5, 2.6, 24), S(4.6, 9, 27), 4.0, true, true),
    tgt: line(S(4.5, 3.6, -6), S(4.5, 6.2, -28), 4.0, true, true),
    lens: lens(32), portrait: { pull: 1.2, lens: 0.85 },
  },
];

// ------------------------------------------------------------------ SCENE 3 - The Hemisphere One Bridge
const S3: Shot[] = [
  {
    // the wave crosses the site and it becomes a controlled environment (wide, slow push)
    id: 'wave', dur: 4.0, scale: 'site',
    pos: line(S(-9, 7.4, 25), S(-7.4, 6.8, 22.5), 4.0, true, true),
    tgt: line(S(4.6, 1.8, -3), S(4.8, 1.8, -3), 4.0, true, true),
    lens: lens(30), portrait: { pull: 1.25, lens: 0.85 },
  },
  {
    // JET plastic formwork (green) on the extension column: medium shot, slow drift
    id: 'jet', dur: 4.0, scale: 'human',
    pos: line(S(0.6, 2.1, 7.6), S(-0.6, 2.2, 7.1), 4.0, true, true),
    tgt: line(S(-3.8, 1.6, -0.1), S(-3.9, 1.65, -0.1), 4.0, true, true),
    lens: lens(32), focus: 'target', fstop: 5.6, portrait: { pull: 1.25, lens: 0.85 },
  },
  {
    // the H1-561 MINI with real premix and chemicals beside it: a slow arc-free truck
    id: 'machine', dur: 3.6, scale: 'human',
    pos: line(S(-3.0, 2.5, 4.2), S(-4.6, 2.45, 4.6), 3.6, true, true),
    tgt: line(S(-7.4, 0.9, -3.4), S(-8.4, 0.9, -3.0), 3.6, true, true),
    lens: lens(30), focus: 'target', fstop: 5.6, portrait: { pull: 1.25, lens: 0.85 },
  },
  {
    // the forms strike: one monolithic wall, no plaster. Slow lateral dolly
    id: 'wall', dur: 3.6, scale: 'human',
    pos: line(S(1.0, 1.8, 8.2), S(4.0, 1.8, 8.2), 3.6, true, true),
    tgt: line(S(3.0, 1.5, 0), S(6.0, 1.5, 0), 3.6, true, true),
    lens: lens(35), focus: 'target', fstop: 5.6, portrait: { pull: 1.2, lens: 0.85 },
  },
  {
    // the builder, satisfied; the neighbourhood behind him is modern now (new light)
    id: 'builder', dur: 3.8, scale: 'human',
    pos: line(S(10.1, 1.66, 1.4), S(10.6, 1.67, 1.7), 3.8, true, true),
    tgt: line(S(12.0, 1.45, 6.2), S(12.05, 1.45, 6.25), 3.8, true, true),
    lens: lens(40), focus: 'target', fstop: 4, portrait: { pull: 1.2, lens: 0.85 },
  },
  {
    // the bridge spreads: one long rise and pull-back as arcs land and modern sites build across the town
    id: 'ecosystem', dur: 7.0, scale: 'city',
    pos: [{ t: 0, v: S(13, 4.5, 26), ease: true }, { t: 2.8, v: S(18, 34, 70) }, { t: 7.0, v: S(26, 104, 128), ease: true }],
    tgt: [{ t: 0, v: S(4.5, 2, -6), ease: true }, { t: 2.8, v: S(4.5, 0, -60) }, { t: 7.0, v: S(0, 0, -150), ease: true }],
    lens: lens(30), portrait: { pull: 1.25, lens: 0.9 },
  },
];

export const SHOTS: Record<SceneId, Shot[]> = { 1: S1, 2: S2, 3: S3 };
export const sceneLength = (s: SceneId) => SHOTS[s].reduce((a, b) => a + b.dur, 0);
/** shot start times within each film */
export const SHOT_STARTS: Record<SceneId, number[]> = { 1: [], 2: [], 3: [] };
(Object.keys(SHOTS) as unknown as SceneId[]).forEach((k) => { let a = 0; SHOT_STARTS[k] = SHOTS[k].map((s) => { const t0 = a; a += s.dur; return t0; }); });

export function shotAt(scene: SceneId, t: number) {
  const list = SHOTS[scene], starts = SHOT_STARTS[scene];
  let i = 0;
  while (i < list.length - 1 && t >= starts[i + 1]) i++;
  return { shot: list[i], index: i, local: t - starts[i], start: starts[i] };
}

/**
 * Construction time per film: a monotonic warp of film time (jumps only at cuts) so each build event happens
 * in the shot that shows it. Scene 1 builds are driven directly by film time (see each building).
 */
const STORY: Record<SceneId, [number, number][]> = {
  1: [[0, 0], [100, 100]],
  2: [[0, 19.0], [4.6, 23.0], [4.6001, 23.8], [8.4, 27.2], [11.7, 28.6], [15.5, 32.8], [19.5, 36.6]],
  3: [[0, 36.8], [4.0, 38.3], [8.0, 41.0], [11.6, 43.8], [11.6001, 45.9], [15.2, 50.0], [19.0, 54.0], [26.0, 61.0]],
};
export const storyTime = (scene: SceneId, t: number) => pw(t, STORY[scene]);
