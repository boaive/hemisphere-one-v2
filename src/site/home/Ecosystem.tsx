import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { View } from '@react-three/drei';
import * as THREE from 'three';
import { PRODUCTS } from '../content';
import { ProductScene } from '../three/ProductObject';
import { navigate } from '../sitemap';
import { Words, useReveal } from './Sections';
import { openInquiry } from './Sidebar';

/**
 * The ecosystem as a train: the five product families glide past continuously (one seamless loop). The
 * navigation along the bottom takes you to a product: the train eases it to the centre and stops there.
 * Every card carries the product as a live 3D object (one shared WebGL canvas, one View per card).
 */
const SPEED = 38;   // px per second, slow enough to read on the move
const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Ecosystem({ id }: { id: string }) {
  const root = useReveal<HTMLElement>(0.15);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const st = useRef({ x: 0, target: null as number | null, paused: false, last: 0 });
  const [active, setActive] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [near, setNear] = useState(false);
  const [reduced] = useState(prefersReduced);
  const loop = [...PRODUCTS, ...PRODUCTS];

  // only run the canvas and the train while the section is close
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '30% 0px' });
    if (root.current) io.observe(root.current);
    return () => io.disconnect();
  }, [root]);

  useEffect(() => {
    if (!near || reduced) return;
    let raf = 0;
    const tick = (now: number) => {
      const s = st.current, tr = track.current, vp = viewport.current;
      if (tr && vp) {
        const dt = s.last ? Math.min(0.05, (now - s.last) / 1000) : 0; s.last = now;
        const setW = tr.scrollWidth / 2;
        if (s.target !== null) {
          s.x += (s.target - s.x) * (1 - Math.exp(-dt * 3.2));
          if (Math.abs(s.target - s.x) < 0.4) { s.x = s.target; s.target = null; }
        } else if (!s.paused) s.x -= SPEED * dt;
        while (s.x <= -setW) { s.x += setW; if (s.target !== null) s.target += setW; }
        while (s.x > 0) { s.x -= setW; if (s.target !== null) s.target -= setW; }
        tr.style.transform = `translate3d(${s.x.toFixed(2)}px, 0, 0)`;
        // the product nearest the centre is the active one
        const mid = vp.clientWidth / 2;
        let best = 0, bd = Infinity;
        cards.current.forEach((c, i) => { if (!c) return; const cx = s.x + c.offsetLeft + c.offsetWidth / 2; const d = Math.abs(cx - mid); if (d < bd) { bd = d; best = i % PRODUCTS.length; } });
        setActive((a) => (a === best ? a : best));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); st.current.last = 0; };
  }, [near, reduced]);

  const goTo = useCallback((i: number) => {
    const s = st.current, vp = viewport.current;
    s.paused = true; setStopped(true); setActive(i);
    if (reduced) { cards.current[i]?.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' }); return; }
    if (!vp) return;
    const mid = vp.clientWidth / 2;
    let best: number | null = null;
    for (const k of [i, i + PRODUCTS.length]) {
      const c = cards.current[k]; if (!c) continue;
      const t = mid - c.offsetLeft - c.offsetWidth / 2;
      if (best === null || Math.abs(t - s.x) < Math.abs(best - s.x)) best = t;
    }
    s.target = best;
  }, [reduced]);
  const resume = () => { st.current.paused = false; st.current.target = null; setStopped(false); };

  return (
    <section ref={root} id={id} className="eco" data-theme="light" aria-label="The ecosystem">
      <div className="wrap eco__head">
        <div>
          <p className="kicker">The ecosystem</p>
          <h2 className="eco__title"><Words text="The entire workflow, under one roof." /></h2>
        </div>
        <div className="eco__aside">
          <p className="eco__lead">Machinery, formwork, reinforcement and concrete chemistry, designed to work together on the same site.</p>
          <button className="btn btn--dark btn--sm" onClick={openInquiry}>Send an inquiry</button>
        </div>
      </div>

      <div className={`eco__viewport ${reduced ? 'is-static' : ''}`} ref={viewport}>
        <div className="eco__track" ref={track}>
          {loop.map((p, i) => {
            const dup = i >= PRODUCTS.length;
            return (
              <article key={i} className="eco__card" ref={(n) => { cards.current[i] = n; }} aria-hidden={dup || undefined}>
                {near ? <View className="eco__view"><ProductScene id={p.id} phase={i * 1.3} reduced={reduced} /></View> : <div className="eco__view" />}
                <div className="eco__meta">
                  <p className="eco__family">{p.family}</p>
                  <h3 className="eco__name">{p.name}</h3>
                  <p className="eco__line">{p.line}</p>
                  <a className="eco__link" href={p.href} tabIndex={dup ? -1 : undefined}
                    {...(p.external ? { target: '_blank', rel: 'noopener noreferrer' } : { onClick: (e: React.MouseEvent) => { e.preventDefault(); navigate(p.href); } })}>
                    Explore {p.name} <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="wrap eco__foot">
        <nav className="eco__nav" aria-label="Products">
          {PRODUCTS.map((p, i) => (
            <button key={p.id} className={i === active ? 'is-active' : ''} aria-current={i === active && stopped ? 'true' : undefined} onClick={() => goTo(i)}>
              <span>{p.family}</span><b>{p.name}</b>
            </button>
          ))}
        </nav>
        {stopped && !reduced && <button className="eco__resume" onClick={resume}>Keep moving <span aria-hidden="true">→</span></button>}
      </div>

      {near && (
        <Canvas className="eco__canvas" eventSource={root as React.MutableRefObject<HTMLElement>} dpr={[1, 1.75]} gl={{ antialias: true, alpha: true }}
          onCreated={({ gl }) => { gl.toneMapping = THREE.AgXToneMapping; gl.setClearColor(0x000000, 0); }}>
          <View.Port />
        </Canvas>
      )}
    </section>
  );
}
