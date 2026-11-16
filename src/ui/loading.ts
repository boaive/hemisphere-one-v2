/** Real asset readiness (no fake percentages): each asset registers once by label, then resolves. */
type L = (done: number, total: number) => void;
const items = new Map<string, { done: boolean; resolve: () => void }>();
const ls = new Set<L>();
const counts = () => { let d = 0; items.forEach((i) => { if (i.done) d++; }); return [d, items.size] as const; };
function emit() { const [d, t] = counts(); ls.forEach((fn) => fn(d, t)); }

export function track(label: string) {
  const existing = items.get(label);
  if (existing) return existing.resolve;          // idempotent (StrictMode double effects, re-mounts)
  const item = { done: false, resolve: () => { if (!item.done) { item.done = true; emit(); } } };
  items.set(label, item); emit();
  return item.resolve;
}
export const onLoading = (fn: L) => { ls.add(fn); const [d, t] = counts(); fn(d, t); return () => { ls.delete(fn); }; };
export const loadingState = () => { const [done, total] = counts(); return { done, total }; };
