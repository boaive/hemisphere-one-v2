import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';

/** offline film renders: `npx vite --config vite.render.config.ts` (port 5300, no HMR, no file watching) */
export default mergeConfig(base, defineConfig({
  server: { port: 5300, strictPort: true, hmr: false, watch: { ignored: ['**/*'] } },
}));
