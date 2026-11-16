// Reads each human GLB's JSON chunk (no decoding needed) and reports what the web app will get.
// node tools/humans/validate_glb.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, '..', '..', 'public', 'models', 'humans');
const out = {};
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.glb'))) {
  const buf = fs.readFileSync(path.join(dir, f));
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${f}: not a GLB`);
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const acc = gltf.accessors;
  let tris = 0;
  const morphs = new Set();
  for (const m of gltf.meshes ?? []) {
    for (const p of m.primitives) {
      if ((p.mode ?? 4) === 4) tris += (p.indices !== undefined ? acc[p.indices].count : acc[p.attributes.POSITION].count) / 3;
    }
    for (const n of m.extras?.targetNames ?? []) morphs.add(n);
  }
  const anims = (gltf.animations ?? []).map((a) => {
    let dur = 0;
    for (const s of a.samplers) dur = Math.max(dur, acc[s.input].max?.[0] ?? 0);
    const morphCh = a.channels.filter((c) => c.target.path === 'weights').length;
    return { name: a.name, seconds: +dur.toFixed(3), channels: a.channels.length, morphChannels: morphCh };
  });
  const nodes = gltf.nodes ?? [];
  const skins = (gltf.skins ?? []).map((s) => s.joints.length);
  out[f] = {
    sizeMB: +(buf.length / 1e6).toFixed(2),
    triangles: Math.round(tris),
    joints: skins,
    morphTargets: [...morphs],
    animations: anims,
    images: (gltf.images ?? []).map((i) => `${i.name ?? ''}:${i.mimeType}`),
    extensionsUsed: gltf.extensionsUsed ?? [],
    extensionsRequired: gltf.extensionsRequired ?? [],
    toolNodes: nodes.filter((n) => n.mesh !== undefined && n.skin === undefined).map((n) => n.name),
  };
}
const target = path.resolve(here, '..', '..', 'docs', 'humans_qc', 'glb_report.json');
fs.writeFileSync(target, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
