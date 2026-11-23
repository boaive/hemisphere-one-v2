import { useCallback, useEffect, useRef, useState } from 'react';
import type { Film, Cue } from '../content';
import { Words } from './Sections';

/**
 * A full-screen chapter: one pre-rendered film playing in the background, with typographic cues timed to the
 * picture and tracking labels pinned to objects in the frame (anchors exported by the offline renderer).
 * The film plays while the chapter is on screen and pauses when it leaves; the only control is a pause toggle beside
 * a slim progress line. With reduced motion, nothing autoplays and the chapter's statements are shown at rest.
 */
type Anchors = { fps: number; frames: Record<string, Record<string, [number, number, number]>> };
const IN = 0.7, OUT = 0.45;
const ease = (u: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function pickVariant() {
  const w = window.innerWidth, h = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
  if (w / h < 0.82) return 'portrait';
  return w * dpr > 1500 ? '1080' : '720';
}

export function FilmSection({ film, theme, id, onActive }: { film: Film; theme: 'light' | 'dark'; id?: string; onActive?: (on: boolean) => void }) {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const cueEls = useRef<(HTMLElement | null)[]>([]);
  const bar = useRef<HTMLElement>(null);
  const anchors = useRef<Anchors | null>(null);
  const [variant] = useState(pickVariant);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [near, setNear] = useState(false);       // has been close once (load the media)
  const [inRange, setInRange] = useState(false); // is close now (run the overlay loop)
  const [reduced] = useState(prefersReduced);
  const userPaused = useRef(false);
  const portrait = variant === 'portrait';
  const base = `/films/${film.id}`;
  const src = portrait ? `${base}-portrait` : `${base}-${variant}`;

  // anchors for tracking labels (per framing)
  useEffect(() => {
    if (!near) return;
    fetch(`${base}${portrait ? '-portrait' : ''}-anchors.json`).then((r) => (r.ok ? r.json() : null)).then((j) => { anchors.current = j; }).catch(() => {});
  }, [near, base, portrait]);

  // load when close, play when on screen, pause when it leaves
  useEffect(() => {
    const el = root.current!;
    const pre = new IntersectionObserver(([e]) => { setInRange(e.isIntersecting); if (e.isIntersecting) setNear(true); }, { rootMargin: '120% 0px' });
    const vis = new IntersectionObserver(([e]) => {
      const v = video.current; if (!v) return;
      const on = e.intersectionRatio > 0.55;
      onActive?.(on);
      if (on && !reduced && !userPaused.current) { if (v.ended) v.currentTime = 0; v.play().catch(() => {}); }
      if (!on) v.pause();
    }, { threshold: [0, 0.55, 1] });
    pre.observe(el); vis.observe(el);
    return () => { pre.disconnect(); vis.disconnect(); };
  }, [reduced, onActive]);

  // one rAF loop: cues + progress (only while the chapter is near)
  const paint = useCallback(() => {
    const v = video.current, el = root.current;
    if (!v || !el) return;
    // before playback starts (or if autoplay is unavailable) the opening title still reads
    const lead = film.cues[0]?.kind === 'title' && v.paused && v.currentTime < 0.05;
    const t = reduced ? film.duration : lead ? 1.4 : v.currentTime;
    const dur = v.duration || film.duration;
    if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, t / dur).toFixed(4)})`;
    const rect = el.getBoundingClientRect();
    const vw = v.videoWidth || (portrait ? 720 : 1920), vh = v.videoHeight || (portrait ? 1280 : 1080);
    const sc = Math.max(rect.width / vw, rect.height / vh);
    const ox = (rect.width - vw * sc) / 2, oy = (rect.height - vh * sc) / 2;
    const A = anchors.current;
    const f = A ? String(Math.min(Math.round(t * A.fps), Object.keys(A.frames).length - 1)) : null;
    film.cues.forEach((c, i) => {
      const n = cueEls.current[i]; if (!n) return;
      const a = ease((t - c.from) / IN), z = c.to > 90 ? 1 : 1 - ease((t - (c.to - OUT)) / OUT);
      // reduced motion: the film rests on its key statement (the title if it has one, otherwise its closing cue)
      const hasTitle = film.cues.some((k) => k.kind === 'title');
      let o = reduced ? (c.kind === 'title' || (!hasTitle && c.to > 90) ? 1 : 0) : lead && c.kind === 'title' ? 1 : Math.min(a, z);
      if (c.kind === 'label') {
        const p = A && f ? A.frames[f]?.[c.anchor] : undefined;
        if (!p || !p[2]) o = 0;
        else {
          const x = ox + p[0] * vw * sc, y = oy + p[1] * vh * sc;
          n.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
          n.classList.toggle('tag--left', x > rect.width - 300);       // keep the label inside the frame
          n.classList.toggle('tag--below', y < 170);
          if (x < 8 || x > rect.width - 8 || y < 60 || y > rect.height - 90) o = 0;
        }
        n.style.setProperty('--draw', String(o));
      } else {
        n.style.setProperty('--in', String(reduced ? 1 : a));
      }
      n.style.opacity = String(o);
      n.style.visibility = o > 0.002 ? 'visible' : 'hidden';
    });
  }, [film, portrait, reduced]);

  useEffect(() => {
    if (!inRange) return;
    let raf = 0;
    const loop = () => { paint(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [inRange, paint]);

  const toggle = () => {
    const v = video.current; if (!v) return;
    if (v.ended || ended) { v.currentTime = 0; userPaused.current = false; v.play().catch(() => {}); return; }
    if (v.paused) { userPaused.current = false; v.play().catch(() => {}); } else { userPaused.current = true; v.pause(); }
  };
  const label = playing ? 'Pause film' : ended ? 'Replay film' : 'Play film';
  return (
    <section ref={root} id={id} className={`film film--${theme} ${playing ? 'is-playing' : ''}`} data-theme={theme} aria-label={film.chapter}>
      <video
        ref={video} className="film__video" muted playsInline disablePictureInPicture preload={near ? 'auto' : 'none'}
        poster={`${base}${portrait ? '-portrait' : ''}-poster.webp`} aria-hidden="true" tabIndex={-1}
        onPlay={() => { setPlaying(true); setEnded(false); }} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setEnded(true); }}
      >
        {near && <source src={`${src}.mp4`} type="video/mp4" />}
      </video>
      <div className="film__scrim" aria-hidden="true" />

      <div className="film__cues">
        {film.cues.map((c, i) => <CueEl key={i} cue={c} first={film.id === 's1'} refEl={(n) => (cueEls.current[i] = n)} />)}
      </div>

      <p className="film__kicker">{film.chapter}</p>
      <div className="film__hud">
        <button className="film__btn" onClick={toggle} aria-label={label}>
          {playing ? <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="2.6" height="10" /><rect x="9.4" y="3" width="2.6" height="10" /></svg>
            : ended ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3a5 5 0 1 0 4.6 3.1" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M12.8 2.6v3.6H9.2" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
              : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2 12.6 8 5 12.8Z" /></svg>}
        </button>
        <span className="film__line" aria-hidden="true"><i ref={bar} /></span>
      </div>
    </section>
  );
}

function CueEl({ cue, first, refEl }: { cue: Cue; first: boolean; refEl: (n: HTMLElement | null) => void }) {
  if (cue.kind === 'label') {
    return (
      <div className="tag" ref={refEl} aria-hidden="true">
        <span className="tag__dot" /><span className="tag__line" />
        <span className="tag__box"><span className="tag__text">{cue.text}</span>{cue.note && <span className="tag__note">{cue.note}</span>}</span>
      </div>
    );
  }
  if (cue.kind === 'lockup') {
    return (
      <div className="lockup" ref={refEl}>
        <img className="lockup__logo" src="/brand/hemisphere-one-logo.png" alt="Hemisphere One" width={460} height={87} />
        <p className="lockup__line">Building Future. Together.</p>
      </div>
    );
  }
  if (cue.kind === 'title') {
    const Tag = first ? 'h1' : 'h2';
    return (
      <div className="cue cue--title" ref={refEl}>
        {cue.sub && <p className="cue__sub">{cue.sub}</p>}
        <Tag className="cue__title"><Words text={cue.text} /></Tag>
      </div>
    );
  }
  return (
    <div className={`cue cue--statement cue--${cue.place ?? 'lower'}`} ref={refEl}>
      <p className="cue__statement"><Words text={cue.text} /></p>
    </div>
  );
}
