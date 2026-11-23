/**
 * Minimal Chrome DevTools Protocol driver (no dependencies: Node 22+ global WebSocket + fetch).
 * Launches the locally installed Chrome headless with GPU rasterisation and exposes `evaluate()`.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ width = 1920, height = 1080, port = 9333, headless = true } = {}) {
  const exe = process.env.CHROME_PATH || CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!exe) throw new Error('Chrome not found; set CHROME_PATH');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'h1-render-'));
  const args = [
    ...(headless ? ['--headless=new'] : []),
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--force-device-scale-factor=1', '--hide-scrollbars', '--mute-audio',
    'about:blank',
  ];
  const proc = spawn(exe, args, { stdio: 'ignore' });
  let ws;
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
    } catch { /* not up yet */ }
    await sleep(250);
  }
  if (!ws) { proc.kill(); throw new Error('Chrome did not expose a page target'); }
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
    } else if (msg.method) listeners.forEach((fn) => fn(msg));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

  const evaluate = async (expression, timeout = 600000) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const navigate = async (url) => {
    const loaded = new Promise((res) => { const fn = (m) => { if (m.method === 'Page.loadEventFired') { listeners.delete(fn); res(); } }; listeners.add(fn); });
    await send('Page.navigate', { url });
    await loaded;
  };
  const onConsole = (fn) => listeners.add((m) => { if (m.method === 'Runtime.consoleAPICalled') fn(m.params.type, m.params.args.map((a) => a.value ?? a.description).join(' ')); if (m.method === 'Runtime.exceptionThrown') fn('exception', m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text); });
  const close = async () => { try { await send('Browser.close'); } catch { /* ignore */ } proc.kill(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* locked */ } };
  return { send, evaluate, navigate, onConsole, close };
}

export async function waitFor(evaluate, expr, ms = 120000, every = 250) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await evaluate(expr)) return true;
    await sleep(every);
  }
  throw new Error(`timeout waiting for ${expr}`);
}
