import { navigate, titleFor } from './sitemap';

/** Branded holding page for internal sections that are not built yet. Structural linework, no warning graphics. */
export function UnderConstruction({ path }: { path: string }) {
  const title = titleFor(path) ?? 'This page';
  return (
    <main className="uc">
      <svg className="uc__grid" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {Array.from({ length: 13 }, (_, i) => <line key={`v${i}`} x1={i * 100} y1="0" x2={i * 100} y2="800" />)}
        {Array.from({ length: 9 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * 100} x2="1200" y2={i * 100} />)}
        <path className="uc__frame" d="M300 640 V260 H900 V640 M300 450 H900 M600 260 V640" />
        <path className="uc__brace" d="M300 640 L600 450 L900 640 M300 260 L600 450 L900 260" />
      </svg>
      <header className="uc__bar">
        <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} aria-label="Hemisphere One home">
          <img src="/brand/hemisphere-one-logo.png" alt="Hemisphere One" height={28} />
        </a>
      </header>
      <section className="uc__body">
        <p className="uc__kicker">{title}</p>
        <h1 className="uc__title">Engineering<br />what’s next.</h1>
        <p className="uc__copy">This section is taking shape.</p>
        <a className="uc__back" href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>
          <span aria-hidden="true">←</span> Back to home
        </a>
      </section>
    </main>
  );
}
