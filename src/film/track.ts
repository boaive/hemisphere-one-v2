/**
 * Time-domain spline tracks (non-uniform Catmull-Rom / cubic Hermite).
 * Keys carry their own time, so speed along the path is art-directed by key spacing.
 * `ease: true` zeroes a key's tangent (the camera arrives / leaves softly). End keys without `ease`
 * keep their one-sided slope, so a shot can be cut while the camera is still moving (cut on motion).
 */
export type Key<T extends number[]> = { t: number; v: T; ease?: boolean };

export function sampleTrack<T extends number[]>(keys: Key<T>[], t: number, out: number[]): number[] {
  const n = keys.length;
  const dim = keys[0].v.length;
  if (n === 1 || t <= keys[0].t) {
    if (n > 1 && !keys[0].ease && t < keys[0].t) return extrapolate(keys, 0, t, out);
    for (let d = 0; d < dim; d++) out[d] = keys[0].v[d];
    return out;
  }
  if (t >= keys[n - 1].t) {
    if (!keys[n - 1].ease && t > keys[n - 1].t) return extrapolate(keys, n - 1, t, out);
    for (let d = 0; d < dim; d++) out[d] = keys[n - 1].v[d];
    return out;
  }
  let i = 0;
  while (i < n - 2 && t > keys[i + 1].t) i++;
  const k0 = keys[i], k1 = keys[i + 1];
  const h = k1.t - k0.t;
  const u = (t - k0.t) / h;
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  for (let d = 0; d < dim; d++) {
    const m0 = tangent(keys, i, d) * h;
    const m1 = tangent(keys, i + 1, d) * h;
    out[d] = h00 * k0.v[d] + h10 * m0 + h01 * k1.v[d] + h11 * m1;
  }
  return out;
}

/** linear continuation past an un-eased end key (keeps motion continuous for shutter samples at the edges) */
function extrapolate<T extends number[]>(keys: Key<T>[], i: number, t: number, out: number[]) {
  const dim = keys[0].v.length;
  for (let d = 0; d < dim; d++) out[d] = keys[i].v[d] + tangent(keys, i, d) * (t - keys[i].t);
  return out;
}

function tangent<T extends number[]>(keys: Key<T>[], i: number, d: number) {
  const k = keys[i];
  if (k.ease) return 0;
  const n = keys.length;
  if (n < 2) return 0;
  if (i === 0) return (keys[1].v[d] - k.v[d]) / (keys[1].t - k.t);
  if (i === n - 1) return (k.v[d] - keys[i - 1].v[d]) / (k.t - keys[i - 1].t);
  const a = keys[i - 1], b = keys[i + 1];
  const s0 = (k.v[d] - a.v[d]) / (k.t - a.t);
  const s1 = (b.v[d] - k.v[d]) / (b.t - k.t);
  // monotone limiter: if the path reverses on this axis, flatten (prevents overshoot wobble)
  if (s0 * s1 <= 0) return 0;
  const w0 = b.t - k.t, w1 = k.t - a.t;
  return (w0 * s0 + w1 * s1) / (w0 + w1);
}
