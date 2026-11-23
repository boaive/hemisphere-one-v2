import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/mona-sans/standard.css';
import './styles.css';
import { App } from './App';

document.documentElement.classList.add('js');
const root = ReactDOM.createRoot(document.getElementById('root')!);

// dev-only offline film renderer (tools/render/film.mjs); never part of the production bundle
const renderMode = new URLSearchParams(window.location.search).get('render');
if (import.meta.env.DEV && renderMode === 'studio') {
  import('./render/StudioApp').then(({ StudioApp }) => root.render(<StudioApp />));
} else if (import.meta.env.DEV && renderMode) {
  import('./render/RenderApp').then(({ RenderApp }) => root.render(<RenderApp />));
} else {
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
