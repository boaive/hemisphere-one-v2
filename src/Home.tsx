import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import Lenis from 'lenis';
import { Scene } from './Scene';
import { film, FILM_DURATION, emitFilm } from './film/clock';
import { Overlay } from './ui/Overlay';
import { Chrome } from './ui/Chrome';
import { Loader } from './ui/Loader';
import { track } from './ui/loading';

const FILM_SCREENS = 13;      // scroll length of the 58 s film (in viewport heights)
const HOLD_SCREENS = 1.1;     // landing hold after the film
/** reduced motion: the film becomes a sequence of composed hold frames (no continuous camera travel) */
const CAPTURE = new URLSearchParams(window.location.search).has('capture');
const HOLDS = [1.5, 6.2, 11.0, 15.8, 21.9, 25.5, 30.5, 35.0, 40.2, 44.6, 48.6, 53.0, 58.0];

export function Home() {
  const [mobile] = useState(() => window.innerWidth / window.innerHeight < 0.85 || window.innerWidth < 760);
  const [mountGL, setMountGL] = useState(false);
  const [worldReady, setWorldReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [dpr, setDpr] = useState(mobile ? 1.25 : 1.5);
  const [quality, setQuality] = useState(1);
  const lenis = useRef<Lenis | null>(null);
  const worldDone = useRef<() => void>();

  useEffect(() => {
    film.mobile = mobile;
    film.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    worldDone.current = track('world');
    // let the loader paint before the main thread builds the world
    const id = requestAnimationFrame(() => setTimeout(() => setMountGL(true), 60));
    return () => cancelAnimationFrame(id);
  }, [mobile]);

  const filmPx = () => window.innerHeight * FILM_SCREENS;
  const onScroll = useCallback((y: number) => {
    const fp = filmPx();
    let t = y <= fp ? (y / fp) * FILM_DURATION : FILM_DURATION + Math.min(0.6, ((y - fp) / (window.innerHeight * HOLD_SCREENS)) * 0.6);
    if (film.reducedMotion && t < FILM_DURATION) t = HOLDS.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a));
    film.target = t;
    emitFilm();
  }, []);

  useEffect(() => {
    const l = new Lenis({ lerp: 0.085, wheelMultiplier: 0.85, touchMultiplier: 1.3, smoothWheel: true });
    lenis.current = l;
    l.on('scroll', (e: { scroll: number }) => onScroll(e.scroll));
    l.stop();
    let raf = 0;
    const loop = (time: number) => { l.raf(time); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const interrupt = () => { if (film.playing) { film.playing = false; setPlaying(false); l.scrollTo(l.scroll, { immediate: true }); } };
    window.addEventListener('wheel', interrupt, { passive: true });
    window.addEventListener('touchstart', interrupt, { passive: true });
    window.addEventListener('keydown', interrupt);
    return () => { cancelAnimationFrame(raf); l.destroy(); window.removeEventListener('wheel', interrupt); window.removeEventListener('touchstart', interrupt); window.removeEventListener('keydown', interrupt); };
  }, [onScroll]);

  useEffect(() => { if (entered) lenis.current?.start(); }, [entered]);

  // dev frame-review tool: ?capture  ->  window.__capture(seconds, name) saves the canvas to docs/frames/
  useEffect(() => {
    if (!CAPTURE) return;
    (window as unknown as Record<string, unknown>).__capture = async (t: number, name: string) => {
      film.t = film.target = t;
      for (let i = 0; i < 8; i++) await new Promise((r) => requestAnimationFrame(r));
      const c = document.querySelector('canvas')!;
      await fetch(`/__capture?name=${encodeURIComponent(name)}`, { method: 'POST', body: c.toDataURL('image/jpeg', 0.88) });
      return name;
    };
  }, []);

  const play = () => {
    const l = lenis.current!; const end = filmPx();
    const remaining = FILM_DURATION - Math.min(film.t, FILM_DURATION);
    if (remaining < 0.5) return;
    film.playing = true; setPlaying(true);
    l.scrollTo(end, { duration: remaining, easing: (x: number) => x, lock: false, onComplete: () => { film.playing = false; setPlaying(false); } });
  };
  const pause = () => { const l = lenis.current!; film.playing = false; setPlaying(false); l.scrollTo(l.scroll, { immediate: true }); };
  const skip = () => {
    film.playing = false; setPlaying(false);
    film.t = film.target = FILM_DURATION + 0.6;
    lenis.current?.scrollTo(filmPx() + window.innerHeight * HOLD_SCREENS, { immediate: true });
  };
  const replay = () => {
    film.playing = false; setPlaying(false);
    film.t = film.target = 0;
    lenis.current?.scrollTo(0, { immediate: true });
  };

  return (
    <div className="home">
      <div className="stage" aria-hidden="true">
        {mountGL && (
          <Canvas
            className="gl" shadows flat dpr={dpr}
            gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: CAPTURE }}
            camera={{ fov: 45, near: 0.5, far: 7000, position: [34, 2, 44] }}
          >
            <PerformanceMonitor onDecline={() => { setDpr((d) => Math.max(1, d - 0.25)); setQuality(0); }} onIncline={() => setDpr((d) => Math.min(mobile ? 1.5 : 1.75, d + 0.25))} />
            <Scene mobile={mobile} quality={quality} onReady={() => { worldDone.current?.(); setWorldReady(true); }} />
          </Canvas>
        )}
      </div>
      <Overlay />
      {entered && <Chrome onSkip={skip} onReplay={replay} onPlay={play} onPause={pause} playing={playing} />}
      {!entered && <Loader worldReady={worldReady} onDone={() => setEntered(true)} />}
      {/* the scroll track: the film is driven by native scroll (smoothed by Lenis) */}
      <div className="track" style={{ height: `${(FILM_SCREENS + HOLD_SCREENS + 1) * 100}svh` }} />
      <noscript>Hemisphere One — Democratising modern construction. Building Future. Together.</noscript>
    </div>
  );
}
