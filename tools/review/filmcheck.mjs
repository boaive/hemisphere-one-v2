/** Capture one film section at given times: node tools/review/filmcheck.mjs --id story --times 2.5,7,11,15,19.5 [--w 1440 --h 900] [--mobile] */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, waitFor } from '../render/cdp.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const url = opt('url', 'http://localhost:5201'), id = opt('id', 'story'), W = Number(opt('w', 1440)), H = Number(opt('h', 900));
const times = String(opt('times', '2.5,7,11,15,19.5')).split(',').map(Number);
const mobile = !!opt('mobile', false);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'renders', 'shots'); fs.mkdirSync(out, { recursive: true });
const chrome = await launch({ width: W, height: H, port: 9555 });
try {
  if (mobile) await chrome.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  await chrome.navigate(url);
  await waitFor(chrome.evaluate, '!!document.querySelector("main")', 30000);
  await new Promise((r) => setTimeout(r, 3000));
  await chrome.evaluate(`document.getElementById(${JSON.stringify(id)}).scrollIntoView(); true`);
  await waitFor(chrome.evaluate, `(() => { const v = document.querySelector('#${id} video'); return v && v.readyState >= 2; })()`, 60000, 300);
  for (const t of times) {
    await chrome.evaluate(`(async () => { const v = document.querySelector('#${id} video'); v.pause(); v.currentTime = ${t}; await new Promise(r => v.addEventListener('seeked', r, { once: true })); await new Promise(r => setTimeout(r, 500)); return true; })()`);
    const { data } = await chrome.send('Page.captureScreenshot', { format: 'jpeg', quality: 84 });
    fs.writeFileSync(path.join(out, `film-${id}-${mobile ? 'm' : 'd'}-${t}.jpg`), Buffer.from(data, 'base64'));
    console.log('shot', t);
  }
} finally { await chrome.close(); }
