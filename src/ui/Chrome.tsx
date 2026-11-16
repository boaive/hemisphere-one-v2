import { useEffect, useRef, useState } from 'react';
import { film, FILM_DURATION, span, smooth } from '../film/clock';
import { SCENES } from '../film/shots';
import { LANDING, SITEMAP, RTARIUM_URL, navigate, type Node } from '../site/sitemap';
import { enableSound } from '../audio/sfx';

type Props = { onSkip: () => void; onReplay: () => void; onPlay: () => void; onPause: () => void; playing: boolean };

/** header, timeline, guided playback, sound, final brand lockup and the landing index */
export function Chrome({ onSkip, onReplay, onPlay, onPause, playing }: Props) {
  const [sound, setSound] = useState(false);
  const [menu, setMenu] = useState(false);
  const [landed, setLanded] = useState(false);
  const rail = useRef<HTMLDivElement>(null);
  const code = useRef<HTMLSpanElement>(null);
  const cue = useRef<HTMLDivElement>(null);
  const brand = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const fills = Array.from(rail.current!.querySelectorAll<HTMLElement>('.tl__fill'));
    const segs = Array.from(rail.current!.querySelectorAll<HTMLElement>('.tl__seg'));
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = film.t;
      SCENES.forEach((s, i) => {
        fills[i].style.transform = `scaleX(${span(t, s.from, s.to).toFixed(4)})`;
        segs[i].classList.toggle('is-active', t >= s.from && t < s.to);
      });
      const sec = Math.min(FILM_DURATION, Math.max(0, t));
      code.current!.textContent = `00:${String(Math.floor(sec)).padStart(2, '0')} / 00:58`;
      cue.current!.style.opacity = String(1 - smooth(span(t, 0.2, 1.2)));
      // final brand lockup: mark draws from the network lines, then the real logo resolves
      const b = brand.current!;
      b.style.setProperty('--draw', String(smooth(span(t, 55.9, 56.9))));
      b.style.setProperty('--logo', String(smooth(span(t, 56.8, 57.4))));
      b.style.setProperty('--copy', String(smooth(span(t, 57.2, 57.9))));
      b.style.visibility = t > 55.8 ? 'visible' : 'hidden';
      const l = t >= 57.6;
      setLanded((was) => (was === l ? was : l));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toggleSound = () => { const on = !sound; setSound(on); film.sound = on; enableSound(on); };
  const link = (n: Node, cls = '') => n.href
    ? <a className={cls} href={n.href} target="_blank" rel="noopener noreferrer">{n.label} <span aria-hidden="true">↗</span><span className="sr">(opens rtarium.com)</span></a>
    : <a className={cls} href={n.path} onClick={(e) => { e.preventDefault(); navigate(n.path!); }}>{n.label}</a>;

  return (
    <>
      <header className="bar">
        <a className="bar__logo" href="/" onClick={(e) => { e.preventDefault(); onReplay(); }} aria-label="Hemisphere One — back to start">
          <img src="/brand/hemisphere-one-logo.png" alt="Hemisphere One" />
        </a>
        <nav className="bar__actions" aria-label="Experience controls">
          {!landed && <button className="btn-text" onClick={onSkip}>Skip<span className="hide-sm"> intro</span></button>}
          <button className="btn-text" onClick={toggleSound} aria-pressed={sound}>
            <span className={`snd ${sound ? 'is-on' : ''}`} aria-hidden="true"><i /><i /><i /></span><span className="hide-sm"> Sound {sound ? 'on' : 'off'}</span><span className="sr">{sound ? 'Sound on' : 'Sound off'}</span>
          </button>
          <button className="btn-text btn-index" onClick={() => setMenu(true)} aria-expanded={menu} aria-controls="index-panel">Index</button>
        </nav>
      </header>

      <div className={`tl ${landed ? 'is-landed' : ''}`} ref={rail} aria-hidden={landed}>
        <button className="tl__play" onClick={playing ? onPause : onPlay} aria-label={playing ? 'Pause film' : 'Play film'}>
          {playing ? <svg viewBox="0 0 12 12"><rect x="2" y="1.5" width="2.6" height="9" /><rect x="7.4" y="1.5" width="2.6" height="9" /></svg>
                   : <svg viewBox="0 0 12 12"><path d="M3 1.5 L10.5 6 L3 10.5 Z" /></svg>}
        </button>
        <div className="tl__segs">
          {SCENES.map((s) => (
            <div className="tl__seg" key={s.id} style={{ flexGrow: s.to - s.from }}>
              <span className="tl__label">{s.label}</span>
              <span className="tl__track"><span className="tl__fill" /></span>
            </div>
          ))}
        </div>
        <span className="tl__code" ref={code}>00:00 / 00:58</span>
      </div>

      <div className="cue" ref={cue} aria-hidden="true"><span>Scroll to begin</span><i /></div>

      <div className="brand" ref={brand} aria-hidden={!landed}>
        <svg className="brand__mark" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="46" pathLength={1} />
          <path d="M8 66 L92 34" pathLength={1} />
          <path d="M44 18 L58 13 L58 46 L44 51 Z" pathLength={1} />
          <path d="M42 54 L56 49 L56 82 L42 87 Z" pathLength={1} />
        </svg>
        <img className="brand__logo" src="/brand/hemisphere-one-logo.png" alt="Hemisphere One" />
        <p className="brand__line">Building future.<br />Together.</p>
        <p className="brand__support">Democratising modern construction through accessible engineering, concrete technology and integrated building solutions.</p>
      </div>

      <nav className={`landing ${landed ? 'is-in' : ''}`} aria-label="Explore Hemisphere One" aria-hidden={!landed}>
        <p className="landing__kicker">Explore the ecosystem</p>
        <ol className="landing__list">
          {LANDING.map((n, i) => (
            <li key={n.label} style={{ transitionDelay: `${0.08 * i}s` }}>
              <span className="landing__num">{String(i + 1).padStart(2, '0')}</span>
              {link(n, 'landing__link')}
              {n.blurb && <span className="landing__blurb">{n.blurb}</span>}
            </li>
          ))}
        </ol>
        <button className="btn-text landing__replay" onClick={onReplay}>↺ Replay the film</button>
      </nav>

      {menu && (
        <div className="index" id="index-panel" role="dialog" aria-modal="true" aria-label="Site index" onKeyDown={(e) => e.key === 'Escape' && setMenu(false)}>
          <button className="btn-text index__close" onClick={() => setMenu(false)} autoFocus>Close</button>
          <div className="index__grid">
            {SITEMAP.map((n, i) => (
              <section key={n.label}>
                <span className="index__num">{String(i + 1).padStart(2, '0')}</span>
                {link(n, 'index__head')}
                {n.children && <ul>{n.children.map((c) => <li key={c.label}>{link(c)}{c.children && <ul>{c.children.map((cc) => <li key={cc.label}>{link(cc)}</li>)}</ul>}</li>)}</ul>}
              </section>
            ))}
          </div>
          <p className="index__foot">RTARIUM opens <a href={RTARIUM_URL} target="_blank" rel="noopener noreferrer">rtarium.com</a></p>
        </div>
      )}
    </>
  );
}
