/**
 * Encode rendered frames into the site's media.
 *   node tools/render/encode.mjs            (all scenes that have frames)
 * Inputs : renders/s<N>_1920x1080/ and renders/s<N>_720x1280/ (PNG frames + anchors.json)
 * Outputs: public/films/s<N>-1080.mp4, -720.mp4, -portrait.mp4, posters (.webp), anchors (.json)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const R = (...p) => path.join(root, ...p);
const films = R('public', 'films');
fs.mkdirSync(films, { recursive: true });
const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });

// anchors each film's labels actually use
const USED = { 1: ['aluform', 'precast', 'factory'], 2: ['plywood', 'brick'], 3: ['jet', 'h1', 'premix', 'wall'] };

function anchors(src, dst, scene) {
  if (!fs.existsSync(src)) return;
  const a = JSON.parse(fs.readFileSync(src, 'utf8'));
  const frames = {};
  for (const [i, f] of Object.entries(a.frames)) {
    const keep = {};
    for (const id of USED[scene]) if (f[id]) keep[id] = [+f[id][0].toFixed(4), +f[id][1].toFixed(4), f[id][2]];
    frames[i] = keep;
  }
  fs.writeFileSync(dst, JSON.stringify({ fps: a.fps, frames }));
}

const only = (() => { const i = process.argv.indexOf('--scenes'); return i < 0 ? [1, 2, 3] : process.argv[i + 1].split(',').map(Number); })();
for (const s of only) {
  const land = R('renders', `s${s}_1920x1080`), port = R('renders', `s${s}_720x1280`);
  if (fs.existsSync(path.join(land, 'f_00000.png'))) {
    const inp = ['-framerate', '30', '-i', path.join(land, 'f_%05d.png')];
    const x264 = ['-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an'];
    ff([...inp, ...x264, '-crf', '21', '-maxrate', '6M', '-bufsize', '12M', path.join(films, `s${s}-1080.mp4`)]);
    ff([...inp, '-vf', 'scale=1280:720:flags=lanczos', ...x264, '-crf', '22', '-maxrate', '3.5M', '-bufsize', '7M', path.join(films, `s${s}-720.mp4`)]);
    ff(['-i', path.join(land, 'f_00000.png'), '-vf', 'scale=1920:1080', '-c:v', 'libwebp', '-quality', '82', path.join(films, `s${s}-poster.webp`)]);
    anchors(path.join(land, 'anchors.json'), path.join(films, `s${s}-anchors.json`), s);
    console.log(`scene ${s}: landscape encoded`);
  }
  if (fs.existsSync(path.join(port, 'f_00000.png'))) {
    ff(['-framerate', '30', '-i', path.join(port, 'f_%05d.png'), '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', '-crf', '23', '-maxrate', '3M', '-bufsize', '6M', path.join(films, `s${s}-portrait.mp4`)]);
    ff(['-i', path.join(port, 'f_00000.png'), '-c:v', 'libwebp', '-quality', '80', path.join(films, `s${s}-portrait-poster.webp`)]);
    anchors(path.join(port, 'anchors.json'), path.join(films, `s${s}-portrait-anchors.json`), s);
    console.log(`scene ${s}: portrait encoded`);
  }
}
for (const f of fs.readdirSync(films)) console.log(`  ${f}  ${(fs.statSync(path.join(films, f)).size / 1e6).toFixed(2)} MB`);
