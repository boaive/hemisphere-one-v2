import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * dev-only: receives frames from the offline film renderer (src/render/RenderApp.tsx).
 * POST /__frame?dir=<name>&i=<n>  (PNG body)  ->  renders/<name>/f_00000.png
 */
function frameSink(): Plugin {
  return {
    name: 'frame-sink',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__frame', (req, res) => {
        const url = new URL(req.url ?? '', 'http://x');
        const dir = (url.searchParams.get('dir') ?? 'frames').replace(/[^a-z0-9_.-]/gi, '_');
        const i = Number(url.searchParams.get('i') ?? 0);
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const out = path.resolve(__dirname, 'renders', dir);
          fs.mkdirSync(out, { recursive: true });
          fs.writeFileSync(path.join(out, `f_${String(i).padStart(5, '0')}.png`), Buffer.concat(chunks));
          res.end('ok');
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), frameSink()],
  server: { port: 5200, watch: { ignored: ['**/renders/**', '**/tools/**'] } },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
  },
});
