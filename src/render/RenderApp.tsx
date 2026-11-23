import { useEffect, useMemo } from 'react';
import { Canvas, advance, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Scene } from '../Scene';
import { film, type SceneId } from '../film/clock';
import { sceneLength, shotAt } from '../film/shots';
import { anchors } from '../world/anchors';
import { loadingState } from '../ui/loading';

/**
 * Offline film renderer (dev only, driven by tools/render/film.mjs through the DevTools protocol).
 * Every output frame averages `spp` sub-frame samples, each with its own sub-pixel jitter (anti-aliasing),
 * shutter time (180-degree motion blur), lens aperture position (depth of field) and sun-disc position
 * (soft shadows). Samples are averaged in linear light on the GPU, then dithered to 8-bit.
 */
const q = new URLSearchParams(window.location.search);
const W = Number(q.get('w') ?? 1920), H = Number(q.get('h') ?? 1080);
const SCENE = Number(q.get('scene') ?? 1) as SceneId;
const FPS = Number(q.get('fps') ?? 30);
const SPP = Math.max(1, Number(q.get('spp') ?? 16));
const DRAFT = q.get('draft') === '1';
const SHUTTER = Number(q.get('shutter') ?? 0.5);    // fraction of the frame interval (0.5 = 180 degrees)

film.render = true;
film.scene = SCENE;
film.portrait = q.get('portrait') === '1';

/** low-discrepancy sample sets (Halton) */
const halton = (i: number, b: number) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
function samples(n: number) {
  return Array.from({ length: n }, (_, s) => {
    const k = s + 1;
    const rr = Math.sqrt(halton(k, 5)) * 0.5, th = 2 * Math.PI * halton(k, 7);      // uniform disc, diameter 1
    const time = ((s + 0.5) / n - 0.5);                                              // stratified over the shutter
    return { time, jx: halton(k, 2) - 0.5, jy: halton(k, 3) - 0.5, ax: rr * Math.cos(th), ay: rr * Math.sin(th), sx: halton(k, 11) * 2 - 1, sy: halton(k, 13) * 2 - 1 };
  }).sort((a, b) => Math.abs(a.time) - Math.abs(b.time));      // sample 0 is the shutter centre (anchor probe)
}

const quadVS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const addFS = /* glsl */ `
uniform sampler2D tSrc; varying vec2 vUv;
vec3 toLin(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
void main(){ gl_FragColor = vec4(toLin(texture2D(tSrc, vUv).rgb), 1.0); }`;
const resolveFS = /* glsl */ `
uniform sampler2D tAcc; uniform float uScale; uniform float uSeed; varying vec2 vUv;
vec3 toSRGB(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
void main(){
  vec3 c = toSRGB(texture2D(tAcc, vUv).rgb * uScale);
  float d = (h(gl_FragCoord.xy) + h(gl_FragCoord.yx + 17.0) - 1.0) / 255.0;   // triangular dither: no banding in skies
  gl_FragColor = vec4(c + d, 1.0);
}`;

function Accumulator() {
  const { gl, size } = useThree();
  const R = useMemo(() => {
    const frameTex = new THREE.FramebufferTexture(W, H);
    const acc = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, depthBuffer: false });
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const add = new THREE.ShaderMaterial({ vertexShader: quadVS, fragmentShader: addFS, uniforms: { tSrc: { value: frameTex } }, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
    const resolve = new THREE.ShaderMaterial({ vertexShader: quadVS, fragmentShader: resolveFS, uniforms: { tAcc: { value: acc.texture }, uScale: { value: 1 }, uSeed: { value: 0 } }, depthTest: false, depthWrite: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), add);
    quad.frustumCulled = false;
    const qs = new THREE.Scene(); qs.add(quad);
    return { frameTex, acc, cam, add, resolve, quad, qs, set: samples(SPP) };
  }, []);

  useEffect(() => {
    let clock = 0;
    const tick = () => { clock += 1000 / (FPS * SPP); advance(clock); };
    const total = Math.round(sceneLength(SCENE) * FPS);

    const renderFrame = async (i: number) => {
      const tc = i / FPS;
      const { start, shot } = shotAt(SCENE, Math.min(tc, sceneLength(SCENE) - 1e-4));
      const end = start + shot.dur - 1e-4;
      gl.setRenderTarget(R.acc); gl.setClearColor(0x000000, 0); gl.clear(true, false, false);
      let probe: Record<string, [number, number, number]> = {};
      R.set.forEach((s, k) => {
        film.t = Math.min(end, Math.max(start, tc + s.time * SHUTTER / FPS));
        film.sub.jx = SPP > 1 ? s.jx : 0; film.sub.jy = SPP > 1 ? s.jy : 0;
        film.sub.ax = SPP > 1 ? s.ax : 0; film.sub.ay = SPP > 1 ? s.ay : 0;
        film.sub.sx = SPP > 1 ? s.sx : 0; film.sub.sy = SPP > 1 ? s.sy : 0;
        tick();
        if (k === 0) {
          probe = {};
          for (const id in anchors) { const a = anchors[id].screen; probe[id] = [+(a.x / size.width).toFixed(4), +(a.y / size.height).toFixed(4), a.visible ? 1 : 0]; }
        }
        gl.setRenderTarget(null);
        gl.copyFramebufferToTexture(R.frameTex);
        const ac = gl.autoClear; gl.autoClear = false;
        R.quad.material = R.add;
        gl.setRenderTarget(R.acc); gl.render(R.qs, R.cam);
        gl.autoClear = ac;
      });
      R.quad.material = R.resolve;
      R.resolve.uniforms.uScale.value = 1 / R.set.length;
      R.resolve.uniforms.uSeed.value = (i * 7.31) % 97;
      gl.setRenderTarget(null);
      gl.render(R.qs, R.cam);
      const blob: Blob = await new Promise((res) => gl.domElement.toBlob((b) => res(b!), 'image/png'));
      return { blob, anchors: probe };
    };

    (window as any).__film = {
      info: { W, H, FPS, SPP, SCENE, total, portrait: film.portrait, draft: DRAFT },
      ready: () => { const s = loadingState(); return s.total > 0 && s.done === s.total; },
      warm: () => { film.t = 0; tick(); tick(); return true; },
      /** render frame i and POST it to the dev server; returns the anchor probe */
      async frame(i: number, dir: string) {
        const { blob, anchors: a } = await renderFrame(i);
        await fetch(`/__frame?dir=${encodeURIComponent(dir)}&i=${i}`, { method: 'POST', body: blob });
        return a;
      },
    };
    return () => { delete (window as any).__film; };
  }, [gl, R, size]);
  return null;
}

export function RenderApp() {
  const fit = Math.min(1, window.innerWidth / W, window.innerHeight / H);
  return (
    <div style={{ width: W, height: H, transform: `scale(${fit})`, transformOrigin: '0 0', background: '#000' }}>
      <Canvas
        frameloop="never" dpr={1} flat shadows
        gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', stencil: false, alpha: false }}
        camera={{ fov: 40, near: 0.5, far: 9000, position: [300, 150, 200] }}
        style={{ width: W, height: H }}
      >
        <Scene draft={DRAFT} />
        <Accumulator />
      </Canvas>
    </div>
  );
}
