/**
 * Homepage copy. Deliberately brief: the homepage sells the idea; detailed specifications are sent on request.
 * Facts come from hemisphere-one.com product pages (read 2026-11-23) and the client's website dossier.
 */
export const CONTACT = {
  email: 'info@hemisphere-one.com',
  phone: '+91 99 20 561 561',
  phoneHref: 'tel:+919920561561',
  profile: 'https://hemisphere-one.com/wp-content/uploads/2026/01/2026-Hemisphere-One-Corporate-Presentation.pdf',
  offices: [
    { city: 'Mumbai', lines: ['Hemisphere One Concrete Technologies Pvt. Ltd.', '#4-6, Damji Shamji Udyog Bhavan, Veera Desai Road', 'Andheri (West), Mumbai 400 053, India'] },
    { city: 'Sharjah', lines: ['Hemisphere One Global FZE', 'Q1-09-053/A, SAIF Zone', 'Sharjah, United Arab Emirates'] },
  ],
  social: [
    { label: 'LinkedIn', href: 'https://in.linkedin.com/in/hemisphere-one-15165b396' },
    { label: 'Instagram', href: 'https://www.instagram.com/hemisphere.one/' },
    { label: 'Facebook', href: 'https://www.facebook.com/hemisphereone1' },
    { label: 'X', href: 'https://x.com/hemisphere_one' },
  ],
};
export const RTARIUM_URL = 'https://rtarium.com';
export const enquiry = (subject = 'Project enquiry') => `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}`;

// ------------------------------------------------------------------ films (overlay cues, seconds into each film)
export type Cue =
  | { kind: 'title'; text: string; from: number; to: number; sub?: string }
  | { kind: 'statement'; text: string; from: number; to: number; place?: 'lower' | 'upper' | 'centre' }
  | { kind: 'label'; text: string; note?: string; anchor: string; from: number; to: number }
  | { kind: 'lockup'; from: number; to: number };
export type Film = { id: 's1' | 's2' | 's3'; index: string; chapter: string; duration: number; cues: Cue[] };

export const FILMS: Film[] = [
  {
    id: 's1', index: '01', chapter: 'The apex of modern construction', duration: 23,
    cues: [
      { kind: 'title', text: 'Successful modern construction technology', from: 0.4, to: 3.2 },
      { kind: 'label', text: 'Aluform Systems', anchor: 'aluform', from: 2.8, to: 5.4 },
      { kind: 'label', text: 'Volumetric Precast', anchor: 'precast', from: 6.0, to: 10.4 },
      { kind: 'label', text: 'Panelized Construction', anchor: 'factory', from: 11.2, to: 15.6 },
      { kind: 'statement', text: 'Speed, precision and sustainability, delivered to the industry’s largest projects.', from: 17.4, to: 99, place: 'lower' },
    ],
  },
  {
    id: 's2', index: '02', chapter: 'The reality on the ground', duration: 19.5,
    cues: [
      { kind: 'label', text: 'High capital entry barriers', anchor: 'plywood', from: 5.1, to: 8.3 },
      { kind: 'label', text: 'The technology gap', anchor: 'brick', from: 12.1, to: 15.4 },
      { kind: 'statement', text: 'Modern technology shouldn’t belong only to the giants.', from: 15.9, to: 99, place: 'centre' },
    ],
  },
  {
    id: 's3', index: '03', chapter: 'The Hemisphere One bridge', duration: 24,
    cues: [
      { kind: 'statement', text: 'We are here to bridge the gap.', from: 0.5, to: 4.0, place: 'upper' },
      { kind: 'label', text: 'Jet Plastic Formwork', anchor: 'jet', from: 4.6, to: 7.9 },
      { kind: 'label', text: 'H1-561 Concrete Machinery', anchor: 'h1', from: 8.5, to: 11.5 },
      { kind: 'label', text: 'Concrete Premix', anchor: 'premix', from: 9.3, to: 11.5 },
      { kind: 'label', text: 'Monolithic wall · zero plastering', anchor: 'wall', from: 13.7, to: 15.1 },
      { kind: 'lockup', from: 19.6, to: 99 },
    ],
  },
];

// ------------------------------------------------------------------ after film 1: what modern construction is
export const MODERN = {
  kicker: 'Modern construction',
  title: 'A building, engineered like a product.',
  lead: 'Modern construction moves the work off the scaffold and into a controlled process. Walls and slabs are cast in precision forms, rooms are finished in the factory, envelopes close in engineered panels.',
  points: [
    { name: 'Precise', line: 'Every element is made to a drawing and checked before it reaches the structure.' },
    { name: 'Fast', line: 'Floors rise in days, because no trade waits on the one before it.' },
    { name: 'Responsible', line: 'Less waste, less rework and less material for the same building.' },
  ],
  cue: 'Beyond the skyline, most sites are still built the old way.',
};

// ------------------------------------------------------------------ after film 2: why the gap persists
export const GAP = {
  kicker: 'Why it hasn’t changed',
  paras: [
    'Modern systems were built for the giants. They arrive as large capital purchases, with specialist crews and a long road to payback, sized for contractors who build at scale.',
    'For the builders who put up most of our homes, schools and shops, that model never fits. Timber, bricks and plaster are familiar, available today and paid for one day at a time. So the old way stays the safe way, and the gap keeps widening.',
    'What has been missing is modern technology sized for a single site, supplied with the materials and the support to use it well.',
  ],
  cue: { words: 'The Hemisphere One bridge', line: 'Elite engineering, in every builder’s hands.' },
};

// ------------------------------------------------------------------ the ecosystem (wording as V1 and hemisphere-one.com)
export type Product = { id: 'h1' | 'formwork' | 'rtarium' | 'admix' | 'premix'; family: string; name: string; line: string; href: string; external?: boolean };
export const PRODUCTS: Product[] = [
  { id: 'h1', family: 'Mixers & Pump', name: 'H1-561 Mini', line: 'Mixing and pumping on one compact machine: concrete from bag to placement, on site.', href: '/h1-561-series/mini' },
  { id: 'formwork', family: 'Formwork', name: 'Jet Formwork', line: 'Modular plastic formwork that replaces timber shuttering. Reusable, no carpentry, no nails.', href: '/jet-formwork' },
  { id: 'rtarium', family: 'Reinforcement', name: 'RTARIUM™', line: 'Three-dimensional basalt textile reinforcement that never corrodes.', href: RTARIUM_URL, external: true },
  { id: 'admix', family: 'Chemicals', name: 'Actipour & Actimix', line: 'Admixtures engineered for workability, strength and a clean finish.', href: '/concrete/chemicals' },
  { id: 'premix', family: 'Premix', name: 'Enermix & Terramix', line: 'Ready-to-use dry-mix concrete: free-flowing, consistent, every bag.', href: '/concrete/premix' },
];

// ------------------------------------------------------------------ footer sitemap (pages are placeholders for now)
export const FOOTER_MAP = [
  { title: 'Products', links: [['H1-561 Series', '/h1-561-series'], ['Jet Formwork', '/jet-formwork'], ['RTARIUM™', RTARIUM_URL], ['Concrete Premix', '/concrete/premix'], ['Concrete Chemicals', '/concrete/chemicals']] },
  { title: 'Solutions', links: [['Housing', '/solutions/housing'], ['Walling', '/solutions/walling'], ['Precast', '/solutions/precast'], ['Flooring', '/solutions/flooring'], ['Infrastructure', '/solutions/infra']] },
  { title: 'Company', links: [['About', '/about'], ['Join our ecosystem', '/ecosystem'], ['Contact', '/contact']] },
] as const;
export const INQUIRY_URL = 'https://hemisphere-one.com/contact-us/';
