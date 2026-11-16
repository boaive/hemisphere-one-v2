/**
 * Cinematic copy, timed to film seconds and placed in each shot's negative space (desktop / mobile).
 * kind: 'statement' = large headline, 'label' = tracked architectural label on a 3D anchor, 'micro' = small sequential words.
 */
export type Place =
  | 'lower-left' | 'upper-left' | 'mid-left' | 'upper-right' | 'mid-right' | 'lower-right' | 'center-left';
export type Beat = {
  id: string; kind: 'statement' | 'label' | 'micro';
  lines: string[]; in: number; out: number;
  place?: Place; mobilePlace?: Place;
  anchor?: string;            // for labels: world anchor id
  dir?: 'left' | 'up' | 'right';
  note?: string;              // small caption under a label
};

export const BEATS: Beat[] = [
  // ---------------- Scene 1 - the apex
  { id: 'redefined', kind: 'statement', lines: ['Modern construction.', 'Redefined.'], in: 0.7, out: 3.7, place: 'lower-left', mobilePlace: 'upper-left', dir: 'up' },
  { id: 'aluform', kind: 'label', lines: ['01 / Aluform Systems'], in: 4.3, out: 7.9, anchor: 'aluform', note: 'Time-lapse · 3 pour cycles' },
  { id: 'psc', kind: 'micro', lines: ['Precision', 'Speed', 'Scale'], in: 5.0, out: 7.9, place: 'lower-left', mobilePlace: 'lower-left' },
  { id: 'precast', kind: 'label', lines: ['02 / Volumetric Precast'], in: 9.5, out: 12.4, anchor: 'precast', note: 'Prefabricated. Precise.' },
  { id: 'panelized', kind: 'label', lines: ['03 / Panelized Construction'], in: 13.9, out: 16.9, anchor: 'factory' },
  { id: 'scale', kind: 'statement', lines: ['Built for scale.'], in: 16.9, out: 18.9, place: 'upper-left', mobilePlace: 'upper-left', dir: 'left' },
  // ---------------- Scene 2 - the reality on the ground
  { id: 'barriers', kind: 'statement', lines: ['High capital.', 'High barriers.'], in: 24.0, out: 27.7, place: 'upper-right', mobilePlace: 'upper-left', dir: 'left' },
  { id: 'gap', kind: 'statement', lines: ['The technology gap.'], in: 29.2, out: 32.7, place: 'upper-left', mobilePlace: 'upper-left', dir: 'up' },
  { id: 'giants', kind: 'statement', lines: ['Modern technology', 'shouldn’t belong', 'only to the giants.'], in: 33.7, out: 37.3, place: 'mid-left', mobilePlace: 'upper-left', dir: 'up' },
  // ---------------- Scene 3 - the bridge
  { id: 'bridge', kind: 'statement', lines: ['We are here', 'to bridge the gap.'], in: 38.5, out: 41.9, place: 'upper-right', mobilePlace: 'lower-left', dir: 'left' },
  { id: 'jet', kind: 'label', lines: ['JET Formwork'], in: 39.7, out: 42.1, anchor: 'jet', note: 'Reusable 300+ times' },
  { id: 'onsite', kind: 'statement', lines: ['Advanced concrete.', 'On site.'], in: 43.1, out: 46.0, place: 'upper-left', mobilePlace: 'lower-left', dir: 'up' },
  { id: 'h1', kind: 'label', lines: ['H1-561 Series'], in: 42.9, out: 46.0, anchor: 'h1', note: 'Mix + pump in one unit' },
  { id: 'precision', kind: 'statement', lines: ['Precision.', 'Without complexity.'], in: 47.8, out: 50.1, place: 'upper-right', mobilePlace: 'upper-left', dir: 'left' },
  // ---------------- ecosystem labels (54-58)
  ...['machinery', 'formwork', 'reinforcement', 'concrete', 'solutions'].map((k, i) => ({
    id: `eco-${k}`, kind: 'label' as const, lines: [k], in: 55.9 + i * 0.12, out: 57.6, anchor: `eco-${k}`,
  })),
];
