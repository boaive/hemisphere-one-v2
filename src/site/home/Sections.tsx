import { useCallback, useEffect, useRef, useState } from 'react';
import { Sidebar, openInquiry, type SideView } from './Sidebar';
import { CONTACT, FOOTER_MAP, enquiry } from '../content';
import { navigate } from '../sitemap';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' });

/** adds `.is-in` once an element enters the viewport (content stays readable without it) */
export function useReveal<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('is-in'); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}

/** splits a line of display type into masked words for a staggered rise */
export function Words({ text, base = 0 }: { text: string; base?: number }) {
  const words = text.split(' ');
  return <>{words.map((w, i) => <span key={i}><span className="w"><span style={{ ['--k' as string]: base + i }}>{w}</span></span>{i < words.length - 1 ? ' ' : ''}</span>)}</>;
}

// ------------------------------------------------------------------ intro loader
export function Loader() {
  const [state, setState] = useState<'in' | 'out' | 'gone'>('in');
  useEffect(() => {
    const t0 = performance.now();
    const poster = new Image(); poster.src = '/films/s1-poster.webp';
    Promise.all([document.fonts.ready, new Promise((r) => { poster.onload = r; poster.onerror = r; })]).then(() => {
      const wait = Math.max(0, 1300 - (performance.now() - t0));
      setTimeout(() => { setState('out'); setTimeout(() => setState('gone'), 1100); }, reduced() ? 0 : wait);
    });
  }, []);
  if (state === 'gone') return null;
  return (
    <div className={`loader ${state === 'out' ? 'is-out' : ''}`} role="status" aria-label="Loading Hemisphere One">
      <img className="loader__logo" src="/brand/hemisphere-one-logo.png" alt="" width={460} height={87} />
      <span className="loader__bar"><i /></span>
      <span className="loader__line">Democratising modern construction</span>
    </div>
  );
}

// ------------------------------------------------------------------ header + sidebar
export function Header({ theme }: { theme: 'light' | 'dark' }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<SideView>('menu');
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const on = () => { setView('form'); setOpen(true); };
    window.addEventListener('h1:inquiry', on);
    return () => window.removeEventListener('h1:inquiry', on);
  }, []);
  const close = useCallback(() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }, []);
  return (
    <>
      <header className={`hdr hdr--${theme}`}>
        <a className="hdr__logo" href="#story" onClick={(e) => { e.preventDefault(); go('story'); }} aria-label="Hemisphere One, back to the top">
          <img className="hdr__mark hdr__mark--light" src="/brand/hemisphere-one-logo.png" alt="Hemisphere One" width={460} height={87} />
          <img className="hdr__mark hdr__mark--dark" src="/brand/hemisphere-one-logo-ink.png" alt="" aria-hidden="true" width={460} height={87} />
        </a>
        <div className="hdr__right">
          <button className="btn btn--accent btn--sm hdr__cta" onClick={openInquiry}>Send an inquiry</button>
          <button ref={trigger} className="hdr__menu" aria-expanded={open} aria-controls="side" onClick={() => { setView('menu'); setOpen(true); }}>
            <span className="hdr__menu-label">Menu</span><span className="hdr__burger" aria-hidden="true"><i /><i /></span>
          </button>
        </div>
      </header>
      <div id="side"><Sidebar open={open} view={view} onClose={close} onView={setView} /></div>
    </>
  );
}

// ------------------------------------------------------------------ chapter rail (desktop): quiet marks, no numbering
const RAIL = [{ id: 'story', label: 'The apex of modern construction' }, { id: 'film-2', label: 'The reality on the ground' }, { id: 'film-3', label: 'The Hemisphere One bridge' }, { id: 'products', label: 'The ecosystem' }];
const RAIL_MAP: Record<string, string> = { story: 'story', modern: 'story', 'film-2': 'film-2', why: 'film-2', bridge: 'film-3', 'film-3': 'film-3', products: 'products', contact: 'products' };
export function Rail({ theme, at: section }: { theme: 'light' | 'dark'; at: string }) {
  const at = RAIL_MAP[section] ?? 'story';
  return (
    <nav className={`rail rail--${theme}`} aria-label="Chapters">
      {RAIL.map((r) => (
        <button key={r.id} className={at === r.id ? 'is-active' : ''} onClick={() => go(r.id)} aria-label={r.label} title={r.label}><i /></button>
      ))}
    </nav>
  );
}

// ------------------------------------------------------------------ footer: closing call to action + sitemap + contact
const internal = (href: string) => href.startsWith('/');
export function Footer() {
  const ref = useReveal<HTMLElement>(0.15);
  return (
    <footer ref={ref} id="contact" className="ftr" data-theme="dark">
      <div className="wrap ftr__close">
        <h2 className="ftr__title"><Words text="Building Future." /> <span className="ftr__accent"><Words text="Together." base={2} /></span></h2>
        <div className="ftr__cta">
          <p>Tell us about your project. Our engineers will recommend the right system, machinery and materials.</p>
          <div className="ftr__btns">
            <button className="btn btn--accent btn--lg" onClick={openInquiry}>Send an inquiry</button>
            <a className="btn btn--line btn--lg" href={CONTACT.profile} target="_blank" rel="noopener noreferrer">Company profile <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </div>

      <div className="wrap ftr__grid">
        <div className="ftr__brand">
          <img src="/brand/hemisphere-one-logo.png" alt="Hemisphere One" width={460} height={87} loading="lazy" />
          <p className="ftr__tag">Construction. Integrated.</p>
        </div>
        <div className="ftr__col">
          <h3>Contact</h3>
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
          <a href={enquiry()}>Write to us</a>
        </div>
        {FOOTER_MAP.map((c) => (
          <nav className="ftr__col" key={c.title} aria-label={c.title}>
            <h3>{c.title}</h3>
            {c.links.map(([label, href]) => (
              <a key={label} href={href} {...(internal(href) ? { onClick: (e: React.MouseEvent) => { e.preventDefault(); navigate(href); } } : { target: '_blank', rel: 'noopener noreferrer' })}>{label}</a>
            ))}
          </nav>
        ))}
        <div className="ftr__offices">
          {CONTACT.offices.map((o) => (
            <address key={o.city}><b>{o.lines[0]}</b>{o.lines.slice(1).map((l) => <span key={l}>{l}</span>)}</address>
          ))}
        </div>
      </div>

      <div className="wrap ftr__legal">
        <span>© {new Date().getFullYear()} Hemisphere One.</span>
        <nav className="ftr__social" aria-label="Social">{CONTACT.social.map((s) => <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a>)}</nav>
        <span><a href="https://hemisphere-one.com/privacy-policy/" target="_blank" rel="noopener noreferrer">Privacy</a><a href="https://hemisphere-one.com/terms-of-use/" target="_blank" rel="noopener noreferrer">Terms</a></span>
      </div>
    </footer>
  );
}
