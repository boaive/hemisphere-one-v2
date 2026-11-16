import { useEffect, useRef } from 'react';
import { film, smooth, span } from '../film/clock';
import { BEATS, type Beat } from '../film/beats';
import { anchors } from '../world/anchors';

/**
 * Typographic layer. Pure DOM, driven from one rAF loop (no React re-renders while scrolling).
 * Statements reveal line by line through a directional mask; labels draw a leader line to their 3D anchor.
 */
const IN = 0.55, OUT = 0.45;

export function Overlay() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const els = BEATS.map((b) => root.current!.querySelector<HTMLElement>(`[data-beat="${b.id}"]`)!);
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = film.t;
      BEATS.forEach((b, i) => {
        const el = els[i];
        const a = smooth(span(t, b.in - 0.05, b.in + IN)), z = 1 - smooth(span(t, b.out - OUT, b.out));
        const v = Math.min(a, z);
        el.style.visibility = v > 0.001 ? 'visible' : 'hidden';
        if (v <= 0.001) return;
        if (b.kind === 'label' && b.anchor) {
          const an = anchors[b.anchor];
          if (!an || !an.screen.visible) { el.style.visibility = 'hidden'; return; }
          el.style.transform = `translate3d(${an.screen.x.toFixed(1)}px, ${an.screen.y.toFixed(1)}px, 0)`;
          el.style.setProperty('--draw', String(a));
          el.style.setProperty('--out', String(1 - z));
          return;
        }
        // statements/micro: each line masked in from its direction; exit wipes upward
        const lines = el.querySelectorAll<HTMLElement>('.ln');
        lines.forEach((ln, k) => {
          const la = smooth(span(t, b.in + k * 0.16, b.in + k * 0.16 + IN));
          const lz = 1 - smooth(span(t, b.out - OUT + k * 0.06, b.out + k * 0.06));
          const reveal = Math.min(la, lz);
          const enter = la < 1;
          const pct = (1 - reveal) * 100;
          const d = b.dir ?? 'up';
          ln.style.clipPath = enter
            ? d === 'left' ? `inset(0 ${pct}% 0 0)` : `inset(${pct}% 0 0 0)`
            : `inset(0 0 ${pct}% 0)`;
          ln.style.transform = `translate3d(0, ${((enter ? 1 - la : -(1 - lz)) * 0.35).toFixed(3)}em, 0)`;
          ln.style.letterSpacing = `${(-0.02 + (1 - la) * 0.05).toFixed(3)}em`;
        });
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="overlay" ref={root} aria-live="off">
      {BEATS.map((b) => <BeatEl key={b.id} b={b} />)}
    </div>
  );
}

function BeatEl({ b }: { b: Beat }) {
  if (b.kind === 'label') {
    return (
      <div className="label" data-beat={b.id}>
        <span className="label__dot" />
        <span className="label__leader" />
        <span className="label__box">
          <span className="label__text">{b.lines[0]}</span>
          {b.note && <span className="label__note">{b.note}</span>}
        </span>
      </div>
    );
  }
  const Tag = b.kind === 'statement' ? 'h2' : 'p';
  return (
    <div className={`beat beat--${b.kind} at--${b.place} m-at--${b.mobilePlace ?? b.place}`} data-beat={b.id}>
      <Tag className={b.kind === 'micro' ? 'micro' : 'statement'}>
        {b.lines.map((l, i) => <span className="ln" key={i}>{l}</span>)}
      </Tag>
    </div>
  );
}
