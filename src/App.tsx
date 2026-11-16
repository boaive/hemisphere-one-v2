import { useEffect, useState } from 'react';
import { Home } from './Home';
import { UnderConstruction } from './site/UnderConstruction';
import { onRoute } from './site/sitemap';

export function App() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => onRoute(() => setPath(window.location.pathname)), []);
  if (path === '/' || path === '') return <Home />;
  return <UnderConstruction path={path} />;
}
