/**
 * Offline film renderer driver.
 *   node tools/render/film.mjs --scene 1 [--w 1920 --h 1080] [--spp 16] [--fps 30] [--portrait]
 *        [--frames 0,30,60 | --from 0 --to 629 | --every 15] [--draft] [--url http://localhost:5200] [--dir name]
 * Frames land in renders/<dir>/f_00000.png with renders/<dir>/anchors.json (normalised label anchors per frame).
 * Requires the Vite dev server to be running (it hosts the renderer page and receives the frames).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, waitFor } from './cdp.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const scene = Number(opt('scene', 1));
const portrait = !!opt('portrait', false);
const W = Number(opt('w', portrait ? 1080 : 1920)), H = Number(opt('h', portrait ? 1920 : 1080));
const spp = Number(opt('spp', 16)), fps = Number(opt('fps', 30));
const draft = !!opt('draft', false);
const url = opt('url', process.env.H1_DEV_URL || 'http://localhost:5200');
const dir = opt('dir', `s${scene}_${W}x${H}${draft ? '_draft' : ''}`);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'renders', dir);
fs.mkdirSync(outDir, { recursive: true });

const chrome = await launch({ width: W, height: H });
chrome.onConsole((type, text) => { if (type === 'error' || type === 'exception' || type === 'warning') console.log(`[page ${type}] ${text}`.slice(0, 400)); });
try {
  const page = `${url}/?render=1&scene=${scene}&w=${W}&h=${H}&spp=${spp}&fps=${fps}${portrait ? '&portrait=1' : ''}${draft ? '&draft=1' : ''}`;
  await chrome.navigate(page);
  await waitFor(chrome.evaluate, 'typeof window.__film === "object"', 120000);
  await waitFor(chrome.evaluate, 'window.__film.ready()', 180000, 500);
  const info = await chrome.evaluate('window.__film.info');
  await chrome.evaluate('window.__film.warm()');
  let frames;
  if (opt('frames', null)) frames = String(opt('frames')).split(',').map(Number);
  else {
    const from = Number(opt('from', 0)), to = Number(opt('to', info.total - 1)), every = Number(opt('every', 1));
    frames = []; for (let i = from; i <= Math.min(to, info.total - 1); i += every) frames.push(i);
  }
  const anchorsPath = path.join(outDir, 'anchors.json');
  const anchors = fs.existsSync(anchorsPath) ? JSON.parse(fs.readFileSync(anchorsPath, 'utf8')) : { fps, w: W, h: H, frames: {} };
  console.log(`scene ${scene} ${W}x${H} spp ${spp} -> ${frames.length} frames of ${info.total} into renders/${dir}`);
  const t0 = Date.now();
  for (let k = 0; k < frames.length; k++) {
    const i = frames[k];
    anchors.frames[i] = await chrome.evaluate(`window.__film.frame(${i}, ${JSON.stringify(dir)})`);
    if (k % 10 === 0 || k === frames.length - 1) {
      const el = (Date.now() - t0) / 1000, per = el / (k + 1);
      console.log(`  frame ${i} (${k + 1}/${frames.length})  ${per.toFixed(2)} s/frame  eta ${Math.round(per * (frames.length - k - 1))} s`);
      fs.writeFileSync(anchorsPath, JSON.stringify(anchors));
    }
  }
  fs.writeFileSync(anchorsPath, JSON.stringify(anchors));
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
} finally {
  await chrome.close();
}
