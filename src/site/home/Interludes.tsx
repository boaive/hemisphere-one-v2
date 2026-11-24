import { lazy, Suspense, useEffect, useRef } from 'react';
import { MODERN, GAP } from '../content';
import { Words, useReveal } from './Sections';

const Playground = lazy(() => import('../three/Playground'));
const KineticTiles = lazy(() => import('../three/KineticTiles'));

/** a line of display type with its key words marked (the mark draws in when the line is revealed) */
function Marked({ text, mark }: { text: string; mark: string }) {
  const i = text.indexOf(mark);
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="hl">{mark}</mark>{text.slice(i + mark.length)}</>;
}

/**
 * After film 1: a regular, light page. What modern construction is and why it stands out, beside a playful
 * cluster of glossy forms that slip out of the pointer's way; then a quiet cue that leads straight into film 2. No numbering, no scroll-driven choreography:
 * elements simply arrive as they come into view.
 */
export function Modern({ id }: { id: string }) {
  const ref = useReveal<HTMLElement>(0.18);
  const cue = useReveal<HTMLDivElement>(0.6);
  const pts = useReveal<HTMLUListElement>(0.3);
  return (
    <section ref={ref} id={id} className="modern" data-theme="light">
      <div className="modern__hero">
        <div className="modern__stage"><Suspense fallback={null}><Playground source={ref} /></Suspense></div>
        <div className="wrap modern__copy">
          <p className="kicker">{MODERN.kicker}</p>
          <h2 className="modern__title"><Words text={MODERN.title} /></h2>
          <p className="modern__lead">{MODERN.lead}</p>
        </div>
      </div>
      <ul ref={pts} className="wrap modern__points">
        {MODERN.points.map((p, i) => (
          <li key={p.name} style={{ ['--k' as string]: i }}><b>{p.name}</b><span>{p.line}</span></li>
        ))}
      </ul>
      <div ref={cue} className="wrap modern__cue">
        <p><Words text={MODERN.cue} /></p>
        <span className="modern__drop" aria-hidden="true" />
      </div>
    </section>
  );
}

/**
 * After film 2: why the gap persists, in five short staged lines over a kinetic tile wall that answers the pointer. The next
 * panel then rises from the bottom edge over it (CSS sticky stacking) while its words arrive one at a time,
 * and film 3 follows.
 */
export function Why({ id }: { id: string }) {
  const stick = useReveal<HTMLElement>(0.2);
  const bridge = useRef<HTMLElement>(null);
  const words = GAP.cue.words.split(' ');

  // a sticky panel taller than the screen sticks by its bottom edge (nothing is ever hidden)
  useEffect(() => {
    const el = stick.current; if (!el) return;
    const fit = () => el.style.setProperty('--stick', `${Math.min(0, window.innerHeight - el.offsetHeight)}px`);
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, []);

  // words of the rising panel arrive with its progress (0 when it appears at the bottom edge, 1 when it lands)
  useEffect(() => {
    const el = bridge.current; if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const spans = Array.from(el.querySelectorAll<HTMLElement>('.bridge__w'));
    const line = el.querySelector<HTMLElement>('.bridge__line');
    let raf = 0;
    const paint = () => {
      raf = 0;
      const top = el.getBoundingClientRect().top, h = window.innerHeight;
      const p = reduced ? 1 : Math.min(1, Math.max(0, 1 - top / h));
      spans.forEach((s, i) => {
        const a = Math.min(1, Math.max(0, (p - 0.28 - i * 0.12) / 0.2));
        s.style.opacity = String(0.12 + 0.88 * a);
        s.style.transform = `translate3d(0, ${((1 - a) * 0.28).toFixed(3)}em, 0)`;
      });
      if (line) line.style.opacity = String(Math.min(1, Math.max(0, (p - 0.82) / 0.15)));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const lines = useReveal<HTMLDivElement>(0.25);
  return (
    <div className="stack">
      <section ref={stick} id={id} className="why" data-theme="dark">
        <div className="why__field"><Suspense fallback={null}><KineticTiles source={stick} /></Suspense></div>
        <div className="wrap why__copy">
          <p className="kicker">{GAP.kicker}</p>
          <div ref={lines} className="why__lines">
            {GAP.lines.map((l, i) => (
              <p key={i} className={`why__line why__line--${l.size}`} style={{ ['--k' as string]: i }}><Marked text={l.text} mark={l.mark} /></p>
            ))}
          </div>
        </div>
      </section>
      <section ref={bridge} id="bridge" className="bridge" data-theme="light" aria-label={GAP.cue.words}>
        <div className="wrap bridge__inner">
          <p className="bridge__words" aria-hidden="true">{words.map((w, i) => <span key={i}><span className="bridge__w">{w}</span>{i < words.length - 1 ? ' ' : ''}</span>)}</p>
          <p className="bridge__line">{GAP.cue.line}</p>
        </div>
      </section>
    </div>
  );
}
