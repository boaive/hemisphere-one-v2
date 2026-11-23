import { lazy, Suspense, useEffect, useState } from 'react';
import { FILMS } from '../content';
import { FilmSection } from './FilmSection';
import { Modern, Why } from './Interludes';
import { Loader, Header, Rail, Footer } from './Sections';

// the ecosystem's live 3D loads after the first film is on screen
const Ecosystem = lazy(() => import('./Ecosystem'));

/**
 * Homepage, one continuous story: film 1 (the apex of modern construction) → what modern construction is →
 * film 2 (the reality on the ground) → why the gap persists, with the bridge rising over it → film 3 (the
 * Hemisphere One bridge) → the ecosystem → footer with the closing call to action.
 */
export function Home() {
  // header colour and chapter rail follow the section under the header (live DOM: works with lazy sections)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [at, setAt] = useState('story');
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const els = document.querySelectorAll<HTMLElement>('main section[data-theme], footer');
      let top: HTMLElement | null = null, mid: HTMLElement | null = null;
      els.forEach((el) => { const r = el.getBoundingClientRect(); if (r.top <= 40 && r.bottom > 40) top = el; if (r.top <= innerHeight / 2 && r.bottom > innerHeight / 2) mid = el; });
      if (top) setTheme(((top as HTMLElement).dataset.theme as 'light' | 'dark') ?? 'dark');
      if (mid) setAt((mid as HTMLElement).id);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(check); };
    window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on);
    const t = setInterval(check, 800);     // catches lazily mounted sections without a scroll
    check();
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); clearInterval(t); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const [s1, s2, s3] = FILMS;
  return (
    <>
      <Loader />
      <a className="skip" href="#products">Skip to the ecosystem</a>
      <Header theme={theme} />
      <Rail theme={theme} at={at} />
      <main>
        <FilmSection id="story" film={s1} theme="light" />
        <Modern id="modern" />
        <FilmSection id="film-2" film={s2} theme="dark" />
        <Why id="why" />
        <FilmSection id="film-3" film={s3} theme="dark" />
        <Suspense fallback={<section id="products" className="eco" data-theme="dark" style={{ minHeight: '100svh' }} />}>
          <Ecosystem id="products" />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
