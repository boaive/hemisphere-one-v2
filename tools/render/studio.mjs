/** Product studio stills: node tools/render/studio.mjs --product h1|jet|rtarium [--w 2400 --h 1800 --spp 64] [--url http://localhost:5300] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, waitFor } from './cdp.mjs';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : args[i + 1]; };
const product = opt('product', 'h1'), W = Number(opt('w', 2400)), H = Number(opt('h', 1800)), spp = Number(opt('spp', 64));
const url = opt('url', 'http://localhost:5300');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const chrome = await launch({ width: 1280, height: 960 });
chrome.onConsole((t, m) => { if (t === 'error' || t === 'exception') console.log(`[page ${t}] ${m}`.slice(0, 300)); });
try {
  await chrome.navigate(`${url}/?render=studio&product=${product}&w=${W}&h=${H}&spp=${spp}`);
  await waitFor(chrome.evaluate, 'typeof window.__studio === "object"', 120000);
  // the PNG goes to the dev server's frame sink (large data URLs stall the DevTools channel)
  const dir = `studio-${product}`;
  await chrome.evaluate(`window.__studio.render().then((d) => fetch(d).then((r) => r.blob())).then((b) => fetch('/__frame?dir=${dir}&i=0', { method: 'POST', body: b })).then(() => true)`, 900000);
  const src = path.join(root, 'renders', dir, 'f_00000.png');
  const out = path.join(root, 'renders', `product-${product}.png`);
  fs.copyFileSync(src, out);
  console.log('wrote', out);
} finally { await chrome.close(); }
