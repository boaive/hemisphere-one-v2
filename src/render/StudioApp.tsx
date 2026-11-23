import { useEffect } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { buildH1 } from '../world/Machine';
import { rbox, merge, place } from '../world/geo';

/**
 * Product studio renderer (dev only): seamless backdrop, soft key / fill / rim, accumulated samples
 * (anti-aliasing, soft shadows, shallow depth of field), Neutral tone mapping.
 *   /?render=studio&product=h1|jet|rtarium&w=2400&h=1800&spp=64  ->  window.__studio.render() returns a PNG data URL
 */
const q = new URLSearchParams(window.location.search);
const W = Number(q.get('w') ?? 2400), H = Number(q.get('h') ?? 1800), SPP = Number(q.get('spp') ?? 64);
const PRODUCT = q.get('product') ?? 'h1';

function jetPanel(w: number, h: number, depth = 0.06) {
  const parts = [place(rbox(w, h, 0.012, 0.003, 1), 0, h / 2, 0.006)];
  parts.push(place(rbox(w, 0.014, depth, 0.003, 1), 0, 0.007, depth / 2), place(rbox(w, 0.014, depth, 0.003, 1), 0, h - 0.007, depth / 2));
  parts.push(place(rbox(0.014, h, depth, 0.003, 1), -w / 2 + 0.007, h / 2, depth / 2), place(rbox(0.014, h, depth, 0.003, 1), w / 2 - 0.007, h / 2, depth / 2));
  for (let y = 0.15; y < h - 0.05; y += 0.15) parts.push(place(rbox(w - 0.02, 0.008, depth * 0.7, 0.002, 1), 0, y, depth * 0.35));
  for (let x = -w / 2 + 0.15; x < w / 2 - 0.05; x += 0.15) parts.push(place(rbox(0.008, h - 0.02, depth * 0.7, 0.002, 1), x, h / 2, depth * 0.35));
  // pin holes along the edge ribs (read as the clip system)
  for (let y = 0.15; y < h; y += 0.3) for (const sx of [-1, 1]) parts.push(place(new THREE.CylinderGeometry(0.009, 0.009, 0.004, 10).rotateZ(Math.PI / 2), sx * (w / 2 - 0.007), y, depth * 0.5));
  return merge(parts);
}

async function buildProduct(): Promise<{ obj: THREE.Object3D; cam: [number, number, number]; tgt: [number, number, number]; fov: number; focus: number; fstop: number; bg: string }> {
  if (PRODUCT === 'jet') {
    const g = new THREE.Group();
    const green = new THREE.MeshStandardMaterial({ color: '#2a3137', roughness: 0.5 });
    const pin = new THREE.MeshStandardMaterial({ color: '#23282c', roughness: 0.5, metalness: 0.3 });
    const panel = jetPanel(0.6, 1.2);
    // an L-shaped wall form: two faces meeting at a corner, two rows high, ribbed backs facing the camera
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(panel, green); m.position.set(-1.2 + i * 0.6 + 0.3, r * 1.2, 0); m.rotation.y = 0; g.add(m); }
      for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(panel, green); m.position.set(1.2 + 0.0, r * 1.2, -0.3 - i * 0.6); m.rotation.y = Math.PI / 2; g.add(m); }
    }
    // wedge clips at the vertical joints
    for (let r = 0; r < 2; r++) for (let i = 1; i < 4; i++) for (const y of [0.3, 0.9]) {
      const c = new THREE.Mesh(rbox(0.03, 0.09, 0.07, 0.006, 2), pin); c.position.set(-1.2 + i * 0.6, r * 1.2 + y, 0.06); g.add(c);
    }
    // a loose panel leaning on the stack, showing the smooth casting face
    for (const [x, z, ry] of [[-1.95, 0.95, Math.PI + 0.35], [-1.55, 1.25, Math.PI + 0.62]] as const) { const lean = new THREE.Mesh(panel, green); lean.position.set(x, 0, z); lean.rotation.set(-0.16, ry, 0); g.add(lean); }
    g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return { obj: g, cam: [3.9, 2.15, 6.3], tgt: [-0.2, 1.05, -0.1], fov: 30, focus: 7.3, fstop: 6.3, bg: '#e9e6df' };
  }
  if (PRODUCT === 'rtarium') {
    const gltf = await new GLTFLoader().loadAsync('/models/rtarium-cell-t10.glb');
    const src = gltf.scene.getObjectByName('RTARIUM_cell_t10_hi') as THREE.Mesh;
    const geo = (src.geometry as THREE.BufferGeometry).clone();
    const mat = new THREE.MeshStandardMaterial({ color: '#4a443d', roughness: 0.42, metalness: 0.25 });
    const nx = 22, nz = 15, pitch = 0.012;
    const im = new THREE.InstancedMesh(geo, mat, nx * nz);
    const m = new THREE.Matrix4();
    let k = 0;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { m.makeTranslation((i - nx / 2) * pitch, 0, (j - nz / 2) * pitch); im.setMatrixAt(k++, m); }
    im.castShadow = true; im.receiveShadow = true;
    const g = new THREE.Group(); g.add(im); g.rotation.set(0.0, -0.45, 0); g.position.y = 0.0055;
    return { obj: g, cam: [0.13, 0.085, 0.17], tgt: [0.0, 0.0, 0.0], fov: 32, focus: 0.225, fstop: 6.3, bg: '#2a2f33' };
  }
  const { group } = buildH1([]);
  return { obj: group, cam: [3.6, 2.15, 4.3], tgt: [0.12, 0.82, 0.0], fov: 30, focus: 5.6, fstop: 5.6, bg: '#e9e6df' };
}

const halton = (i: number, b: number) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };

export function StudioApp() {
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H; canvas.style.width = '100%'; canvas.style.maxWidth = `${W}px`;
    document.getElementById('root')!.appendChild(canvas);
    const gl = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
    gl.setPixelRatio(1); gl.setSize(W, H, false);
    gl.shadowMap.enabled = true; gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(gl);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.42;
    const accRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType });
    const frameRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 0 });
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const add = new THREE.ShaderMaterial({ uniforms: { t: { value: frameRT.texture } }, vertexShader: 'varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: 'uniform sampler2D t; varying vec2 v; void main(){ gl_FragColor = texture2D(t, v); }', blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, depthTest: false, depthWrite: false });
    const resolve = new THREE.ShaderMaterial({ uniforms: { t: { value: accRT.texture }, k: { value: 1 } }, vertexShader: 'varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: '#include <tonemapping_pars_fragment>\nuniform sampler2D t; uniform float k; varying vec2 v; vec3 enc(vec3 c){ c = clamp(c,0.,1.); return mix(c*12.92, 1.055*pow(c, vec3(1./2.4))-0.055, step(0.0031308,c)); } float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }\nvoid main(){ vec3 c = NeutralToneMapping(texture2D(t, v).rgb * k); gl_FragColor = vec4(enc(c) + (h(gl_FragCoord.xy) - 0.5) / 255., 1.); }',
      depthTest: false, depthWrite: false, toneMapped: false });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), add); const qs = new THREE.Scene(); qs.add(quad);

    (window as any).__studio = {
      async render() {
        const P = await buildProduct();
        scene.background = new THREE.Color(P.bg);
        scene.add(P.obj);
        // seamless backdrop: floor + curved cove in the backdrop colour (catches soft contact shadows)
        const backMat = new THREE.MeshStandardMaterial({ color: P.bg, roughness: 0.95 });
        const box = new THREE.Box3().setFromObject(P.obj); const size = box.getSize(new THREE.Vector3()); const sc = Math.max(size.x, size.y, size.z);
        // seamless cove: floor sweeping up into a back wall (no visible horizon)
        const R = sc * 3, D = sc * 3.2;
        const prof = [new THREE.Vector2(sc * 12, 0)];
        for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI / 2; prof.push(new THREE.Vector2(-D - Math.sin(a) * R, R - Math.cos(a) * R)); }
        prof.push(new THREE.Vector2(-D - R, sc * 14));
        const pts = prof.map((p) => new THREE.Vector3(0, p.y, p.x));
        const cove = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.001, 3, false), backMat);
        void cove;
        const shape: THREE.Vector3[] = pts;
        const geo = new THREE.BufferGeometry();
        const wv = sc * 30, verts: number[] = [], idx: number[] = [];
        shape.forEach((p) => { verts.push(-wv, p.y, p.z, wv, p.y, p.z); });
        for (let i = 0; i < shape.length - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geo.setIndex(idx); geo.computeVertexNormals();
        const back = new THREE.Mesh(geo, backMat); back.receiveShadow = true; back.position.y = box.min.y - 0.0005;
        back.rotation.y = Math.atan2(P.cam[0] - P.tgt[0], P.cam[2] - P.tgt[2]);
        back.position.x = P.tgt[0]; back.position.z = P.tgt[2];
        scene.add(back);
        if (back.geometry.attributes.normal.getY(0) < 0) { back.geometry.index!.array.reverse(); back.geometry.computeVertexNormals(); }
        backMat.side = THREE.DoubleSide;
        const hemi = new THREE.HemisphereLight('#ffffff', P.bg, 0.42); scene.add(hemi);
        const key = new THREE.DirectionalLight('#fff7ee', 3.3); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
        const cs = sc * 1.4; Object.assign(key.shadow.camera, { left: -cs, right: cs, top: cs, bottom: -cs, near: 0.01, far: sc * 20 }); key.shadow.camera.updateProjectionMatrix();
        key.shadow.bias = -0.0002; key.shadow.normalBias = sc * 0.002;
        scene.add(key, key.target);
        const rim = new THREE.DirectionalLight('#eaf2ff', 1.1); scene.add(rim, rim.target);
        const cam = new THREE.PerspectiveCamera(P.fov, W / H, sc * 0.01, sc * 60);
        const C = new THREE.Vector3(...P.cam), T = new THREE.Vector3(...P.tgt);
        const right = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();
        gl.setRenderTarget(accRT); gl.setClearColor(0, 0); gl.clear();
        for (let s = 0; s < SPP; s++) {
          const k = s + 1;
          // soft key: jitter the light across a large virtual softbox; rim from behind
          const kx = (halton(k, 11) - 0.5) * 0.9, ky = (halton(k, 13) - 0.5) * 0.6;
          key.position.set(T.x - sc * (2.2 + kx), T.y + sc * (3.2 + ky), T.z + sc * (2.0 - kx)); key.target.position.copy(T);
          rim.position.set(T.x + sc * 1.5, T.y + sc * 2.2, T.z - sc * 3.2); rim.target.position.copy(T);
          // camera with aperture sample (depth of field) + sub-pixel jitter
          cam.position.copy(C); cam.lookAt(T); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
          cam.matrixWorld.extractBasis(right, up, fwd);
          const rr = Math.sqrt(halton(k, 5)) * 0.5, th = 2 * Math.PI * halton(k, 7);
          const ap = (cam.getFocalLength() / 1000) / P.fstop * (sc / 2.5);
          const ax = rr * Math.cos(th) * ap, ay = rr * Math.sin(th) * ap;
          cam.position.addScaledVector(right, ax).addScaledVector(up, ay); cam.updateMatrixWorld();
          const E = cam.projectionMatrix.elements;
          E[8] += -E[0] * ax / P.focus + (2 * (halton(k, 2) - 0.5)) / W;
          E[9] += -E[5] * ay / P.focus + (2 * (halton(k, 3) - 0.5)) / H;
          cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
          const tm = gl.toneMapping; gl.toneMapping = THREE.NoToneMapping;
          gl.setRenderTarget(frameRT); gl.clear(); gl.render(scene, cam);
          gl.toneMapping = tm;
          quad.material = add; gl.autoClear = false; gl.setRenderTarget(accRT); gl.render(qs, quadCam); gl.autoClear = true;
          // flush and yield every sample: keeps each GPU submission short (avoids the OS GPU watchdog on heavy meshes)
          gl.getContext().finish();
          await new Promise((r) => setTimeout(r, 0));
        }
        quad.material = resolve; resolve.uniforms.k.value = 1 / SPP;
        gl.setRenderTarget(null); gl.render(qs, quadCam);
        return canvas.toDataURL('image/png');
      },
    };
  }, []);
  return null;
}
