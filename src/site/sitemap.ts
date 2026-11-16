/** Information architecture from HEMISPHERE-ONE-WEBSITE-CONTENT-MAPPING.pdf. Internal pages are "under construction". */
export type Node = { label: string; path?: string; href?: string; children?: Node[]; blurb?: string };

export const RTARIUM_URL = 'https://rtarium.com';

export const SITEMAP: Node[] = [
  { label: 'H1-561 Series', path: '/h1-561-series', blurb: 'Mobile mixers and pumping plants for on-site concrete production.',
    children: ['PRO', 'CORE', 'MINI', 'ECO'].map((m) => ({ label: `H1-561-${m}`, path: `/h1-561-series/${m.toLowerCase()}` })) },
  { label: 'JET Formwork', path: '/jet-formwork', blurb: 'Reusable over 300 times. Recyclable. Gang-set repeatable.' },
  { label: 'RTARIUM', href: RTARIUM_URL, blurb: 'Basalt 3D spacer mesh · 15 | 10 | 6 | 3 mm.' },
  { label: 'Concrete', path: '/concrete', blurb: 'Premix and chemicals.', children: [
    { label: 'Premix', path: '/concrete/premix', children: [{ label: 'ENERMIX', path: '/concrete/premix/enermix' }, { label: 'TERRAMIX', path: '/concrete/premix/terramix' }] },
    { label: 'Chemicals', path: '/concrete/chemicals', children: [{ label: 'ACTIPOUR', path: '/concrete/chemicals/actipour' }, { label: 'ACTIMIX', path: '/concrete/chemicals/actimix' }] },
  ] },
  { label: 'Solutions', path: '/solutions', blurb: 'Housing · Walling · Precast · Flooring · Infra.', children: [
    { label: 'Housing', path: '/solutions/housing' }, { label: 'Walling', path: '/solutions/walling' }, { label: 'Precast', path: '/solutions/precast' },
    { label: 'Flooring', path: '/solutions/flooring' }, { label: 'Infra', path: '/solutions/infra' },
  ] },
];

/** the five landing-state destinations */
export const LANDING = SITEMAP;

export function titleFor(path: string): string | null {
  const walk = (ns: Node[]): string | null => {
    for (const n of ns) {
      if (n.path === path) return n.label;
      if (n.children) { const r = walk(n.children); if (r) return r; }
    }
    return null;
  };
  return walk(SITEMAP);
}

// tiny history router (no dependency)
type L = () => void;
const ls = new Set<L>();
export const onRoute = (fn: L) => { ls.add(fn); return () => { ls.delete(fn); }; };
export function navigate(path: string) {
  if (path === window.location.pathname) return;
  window.history.pushState({}, '', path);
  window.scrollTo(0, 0);
  ls.forEach((fn) => fn());
}
window.addEventListener('popstate', () => ls.forEach((fn) => fn()));
