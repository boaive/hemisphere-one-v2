import { useEffect, useState } from 'react';
import { onLoading } from './loading';

/**
 * Branded entry: an architectural elevation (columns + floor lines) draws in with REAL asset readiness.
 * When the world has rendered its first frame, the grid wipes upward floor by floor to reveal the tower behind it.
 */
export function Loader({ worldReady, onDone }: { worldReady: boolean; onDone: () => void }) {
  const [p, setP] = useState(0);
  const [out, setOut] = useState(false);
  useEffect(() => onLoading((d, t) => setP(t ? d / t : 0)), []);
  useEffect(() => {
    if (worldReady && p >= 1 && !out) {
      const id = setTimeout(() => { setOut(true); setTimeout(onDone, 1300); }, 250);
      return () => clearTimeout(id);
    }
  }, [worldReady, p, out, onDone]);
  const prog = worldReady ? Math.max(p, 0.999) : Math.min(p, 0.97);
  const floors = 16, cols = 5;
  return (
    <div className={`loader ${out ? 'is-out' : ''}`} role="status" aria-live="polite" aria-label={`Loading the experience, ${Math.round(prog * 100)} percent`}>
      <svg className="loader__draw" viewBox="0 0 400 520" aria-hidden="true">
        {Array.from({ length: cols }, (_, i) => (
          <line key={`c${i}`} className="loader__col" x1={80 + i * 60} y1={480} x2={80 + i * 60} y2={480 - 400 * Math.min(1, prog * 1.15)} />
        ))}
        {Array.from({ length: floors }, (_, i) => {
          const k = Math.min(1, Math.max(0, prog * floors - i));
          return <line key={`f${i}`} className="loader__floor" x1={80} y1={480 - i * 25} x2={80 + 240 * k} y2={480 - i * 25} />;
        })}
        <line className="loader__ground" x1={20} y1={480} x2={380} y2={480} />
      </svg>
      <div className="loader__brand">
        <img src="/brand/hemisphere-one-logo.png" alt="Hemisphere One" />
        <span className="loader__rule"><i style={{ transform: `scaleX(${prog})` }} /></span>
        <span className="loader__caption">Democratising modern construction</span>
      </div>
    </div>
  );
}
