/**
 * Screenshot review of the homepage at real viewport sizes (headless Chrome, rendering in the foreground).
 *   node tools/review/shots.mjs [--url http://localhost:5200] [--w 1440 --h 900] [--name desk] [--mobile]
 * Captures each section (scrolled into view, after its reveal) into renders/shots/<name>-<section>.png
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, waitFor } from '../render/cdp.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const url = opt('url', 'http://localhost:5200'), W = Number(opt('w', 1440)), H = Number(opt('h', 900)), name = opt('name', `${W}x${H}`);
const mobile = !!opt('mobile', false);
const at = opt('at', null);   // optional: seconds into each film to seek before capturing
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'renders', 'shots'); fs.mkdirSync(out, { recursive: true });
const chrome = await launch({ width: W, height: H, port: 9444 });
chrome.onConsole((t, m) => { if (t === 'error' || t === 'exception') console.log(`[page ${t}] ${m}`.slice(0, 300)); });
try {
  if (mobile) await chrome.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  await chrome.navigate(url);
  await waitFor(chrome.evaluate, '!!document.querySelector("main")', 30000);
  await new Promise((r) => setTimeout(r, 3200));
  const ids = await chrome.evaluate('[...document.querySelectorAll("main > section, footer")].flatMap((e, i) => { const id = e.id || ("s" + i); return e.offsetHeight > innerHeight * 1.5 ? [id, id + "@0.55"] : [id]; })');
  for (const id of ids) {
    const [sid, frac] = id.split('@');
    await chrome.evaluate(`(async () => { const el = document.getElementById(${JSON.stringify(sid)}) || document.querySelectorAll("main > section, footer")[${JSON.stringify(sid)}.slice(1)];
      window.scrollTo(0, el.offsetTop + ${Number(frac || 0)} * (el.offsetHeight - innerHeight));
      ${at ? `const v = el.querySelector('video'); if (v) { v.pause(); v.currentTime = ${Number(at)}; await new Promise(r => v.addEventListener('seeked', r, { once: true })); }` : ''}
      await new Promise(r => setTimeout(r, 1600)); return true; })()`);
    const { data } = await chrome.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
    fs.writeFileSync(path.join(out, `${name}-${id.replace('@', '_')}.jpg`), Buffer.from(data, 'base64'));
    console.log('shot', id);
  }
} finally { await chrome.close(); }
