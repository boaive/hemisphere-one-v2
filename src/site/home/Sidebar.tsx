import { useEffect, useRef, useState } from 'react';
import { CONTACT, FOOTER_MAP } from '../content';
import { navigate } from '../sitemap';

/**
 * The menu as a compact left sidebar on a light panel: the four destinations, the product pages and contact
 * details, plus the inquiry form (opened directly by every "Send an inquiry" button). The form hands the message
 * to the visitor's email app until a form backend exists, and says so.
 */
export type SideView = 'menu' | 'form';
/** any button on the page can open the inquiry form */
export const openInquiry = () => window.dispatchEvent(new CustomEvent('h1:inquiry'));
const NAV = [
  { label: 'The story', id: 'story' },
  { label: 'Modern construction', id: 'modern' },
  { label: 'The ecosystem', id: 'products' },
  { label: 'Contact', id: 'contact' },
];
const INTERESTS = ['A complete project', 'H1-561 Series', 'Jet Formwork', 'RTARIUM™', 'Concrete premix', 'Concrete chemicals'];
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Sidebar({ open, view, onClose, onView }: { open: boolean; view: SideView; onClose: () => void; onView: (v: SideView) => void }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add('menu-open');
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>('a, input, button.side__first')?.focus({ preventScroll: true }), 380);
    return () => { document.documentElement.classList.remove('menu-open'); window.removeEventListener('keydown', k); clearTimeout(t); };
  }, [open, view, onClose]);
  const go = (id: string) => { onClose(); setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' }), 260); };
  const products = FOOTER_MAP[0].links;

  return (
    <div className={`side ${open ? 'is-open' : ''}`} aria-hidden={!open} {...(!open ? { inert: '' } : {})}>
      <div className="side__scrim" onClick={onClose} />
      <aside ref={panel} className="side__panel" role="dialog" aria-modal="true" aria-label={view === 'form' ? 'Send an inquiry' : 'Menu'}>
        <div className="side__top">
          <img className="side__logo" src="/brand/hemisphere-one-logo-ink.png" alt="Hemisphere One" width={460} height={87} />
          <button className="side__close" onClick={onClose} aria-label="Close">Close<span aria-hidden="true" /></button>
        </div>

        {view === 'menu' ? (
          <div className="side__body" key="menu">
            <nav className="side__nav" aria-label="Primary">
              {NAV.map((n, i) => (
                <a key={n.id} href={`#${n.id}`} style={{ ['--k' as string]: i }} onClick={(e) => { e.preventDefault(); go(n.id); }}>{n.label}<span aria-hidden="true">→</span></a>
              ))}
            </nav>
            <div className="side__block">
              <p className="side__label">Products</p>
              {products.map(([label, href]) => (
                <a key={label} href={href} {...(href.startsWith('/') ? { onClick: (e: React.MouseEvent) => { e.preventDefault(); onClose(); navigate(href); } } : { target: '_blank', rel: 'noopener noreferrer' })}>{label}</a>
              ))}
            </div>
            <button className="btn btn--accent side__cta" onClick={() => onView('form')}>Send an inquiry</button>
            <div className="side__contact">
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
              <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
              <span>Mumbai · Sharjah</span>
            </div>
          </div>
        ) : (
          <InquiryForm key="form" onBack={() => onView('menu')} />
        )}
      </aside>
    </div>
  );
}

function InquiryForm({ onBack }: { onBack: () => void }) {
  const [sent, setSent] = useState(false);
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? '').trim();
    const subject = `Inquiry: ${v('interest') || 'Project'}${v('company') ? ` (${v('company')})` : ''}`;
    const body = [`Name: ${v('name')}`, v('company') && `Company: ${v('company')}`, `Email: ${v('email')}`, v('phone') && `Phone: ${v('phone')}`, `Interest: ${v('interest')}`, '', v('message')].filter((l) => l !== '').join('\n');
    window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };
  if (sent) {
    return (
      <div className="side__body side__done">
        <p className="side__label">Inquiry</p>
        <h2 className="side__title">Thank you.</h2>
        <p className="side__note">Your email app has opened with the inquiry ready to send. If it did not, write to <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> or call <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>.</p>
        <button className="side__back side__first" onClick={onBack}>← Back to the menu</button>
      </div>
    );
  }
  return (
    <form className="side__body side__form" onSubmit={submit}>
      <button type="button" className="side__back" onClick={onBack}>← Menu</button>
      <h2 className="side__title">Send an inquiry</h2>
      <p className="side__note">Tell us about your project. Our engineers will recommend the right system, machinery and materials.</p>
      <label><span>Name</span><input name="name" required autoComplete="name" /></label>
      <label><span>Company</span><input name="company" autoComplete="organization" /></label>
      <div className="side__row">
        <label><span>Email</span><input name="email" type="email" required autoComplete="email" /></label>
        <label><span>Phone</span><input name="phone" type="tel" autoComplete="tel" /></label>
      </div>
      <label><span>Interested in</span>
        <select name="interest" defaultValue={INTERESTS[0]}>{INTERESTS.map((i) => <option key={i}>{i}</option>)}</select>
      </label>
      <label><span>Message</span><textarea name="message" rows={4} /></label>
      <button className="btn btn--accent side__send" type="submit">Send inquiry</button>
      <p className="side__fine">Opens your email app with the message ready to send to {CONTACT.email}.</p>
    </form>
  );
}
