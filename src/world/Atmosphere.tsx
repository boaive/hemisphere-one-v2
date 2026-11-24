import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { film } from '../film/clock';
import { activeLook, sunDir, type Look } from '../film/looks';
import { camState } from '../film/CameraRig';

/**
 * Sky, sun, fill, haze and image-based light for each film. The environment map is generated from the same
 * sky the camera sees, so reflections and ambient light always agree with the background.
 */
export const SUN = new THREE.Vector3(0, 1, 0);

const gradientVS = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = normalize(wp.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * wp;
  gl_Position.z = gl_Position.w; // on the far plane
}`;
const gradientFS = /* glsl */ `
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uSun; uniform float uIntensity;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 c = mix(uHorizon, uZenith, pow(smoothstep(0.0, 1.0, max(h, 0.0)), 0.55));
  float s = max(dot(d, normalize(uSun)), 0.0);
  c += uGlow * (pow(s, 10.0) * 0.22 + pow(s, 120.0) * 0.5);
  c = mix(c, uHorizon * 0.97, smoothstep(0.0, -0.2, h));
  gl_FragColor = vec4(c * uIntensity, 1.0);
}`;

function makeGradientSky() {
  const m = new THREE.ShaderMaterial({
    vertexShader: gradientVS, fragmentShader: gradientFS, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uIntensity: { value: 1 } },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), m);
  mesh.scale.setScalar(4000);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}

function makePhysicalSky() {
  const sky = new Sky();
  sky.scale.setScalar(4000);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  (sky.material as THREE.ShaderMaterial).depthWrite = false;
  return sky;
}

export function Atmosphere() {
  const { scene, gl, camera } = useThree();
  const scn = useRef<string>('');

  const rig = useMemo(() => {
    const sun = new THREE.DirectionalLight('#ffffff', 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.03;
    const fill = new THREE.HemisphereLight('#ffffff', '#888888', 0.5);
    const gradient = makeGradientSky();
    const physical = makePhysicalSky();
    return { sun, fill, gradient, physical, envRT: null as THREE.WebGLRenderTarget | null, tmp: { f: new THREE.Vector3(), c: new THREE.Vector3(), d: { x: 0, y: 1, z: 0 } } };
  }, []);

  useEffect(() => {
    scene.fog = new THREE.FogExp2('#ffffff', 0.001);
    scene.add(rig.gradient, rig.physical);
    return () => { scene.fog = null; scene.remove(rig.gradient, rig.physical); rig.envRT?.dispose(); };
  }, [scene, rig]);

  /** configure everything that is constant within a film; regenerate the environment map from the sky */
  const configure = (key: string, L: Look) => {
    sunDir(L, rig.tmp.d);
    SUN.set(rig.tmp.d.x, rig.tmp.d.y, rig.tmp.d.z);
    const grad = L.sky.kind === 'gradient';
    rig.gradient.visible = grad; rig.physical.visible = !grad;
    if (L.sky.kind === 'gradient') {
      const u = (rig.gradient.material as THREE.ShaderMaterial).uniforms;
      u.uZenith.value.set(L.sky.zenith); u.uHorizon.value.set(L.sky.horizon); u.uGlow.value.set(L.sky.glow); u.uSun.value.copy(SUN); u.uIntensity.value = L.sky.intensity;
    } else {
      const u = (rig.physical.material as THREE.ShaderMaterial).uniforms;
      u.turbidity.value = L.sky.turbidity; u.rayleigh.value = L.sky.rayleigh; u.mieCoefficient.value = L.sky.mie; u.mieDirectionalG.value = L.sky.g;
      u.sunPosition.value.copy(SUN).multiplyScalar(1000);
    }
    const fog = scene.fog as THREE.FogExp2;
    fog.color.set(L.fog.color); fog.density = L.fog.density;
    rig.sun.color.set(L.sun.color); rig.sun.intensity = L.sun.intensity;
    rig.fill.color.set(L.fill.sky); rig.fill.groundColor.set(L.fill.ground); rig.fill.intensity = L.fill.intensity;
    // image-based light from the visible sky
    const envScene = new THREE.Scene();
    const src = grad ? rig.gradient.clone() : rig.physical.clone();
    src.visible = true; src.scale.setScalar(100);
    if (!grad) {
      // the physical sky is HDR; scale it down for the environment so ambient stays believable
      const m = (src as THREE.Mesh).material as THREE.ShaderMaterial;
      (src as THREE.Mesh).material = m.clone();
      ((src as THREE.Mesh).material as THREE.ShaderMaterial).uniforms = THREE.UniformsUtils.clone(m.uniforms);
    }
    envScene.add(src);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: L.fill.ground }));
    ground.position.y = -2; envScene.add(ground);
    const pm = new THREE.PMREMGenerator(gl);
    rig.envRT?.dispose();
    rig.envRT = pm.fromScene(envScene, 0.04, 0.1, 1000);
    pm.dispose();
    scene.environment = rig.envRT.texture;
    scene.environmentIntensity = L.env * (grad ? 1 : 0.35);
    scn.current = key;
  };

  useFrame(() => {
    const A = activeLook(film.scene, film.story);
    if (scn.current !== A.key) configure(A.key, A.look);
    const L = A.look;
    // soft shadows: offline renders jitter the sun across a small disc, averaged by accumulation
    sunDir(L, rig.tmp.d, film.render ? film.sub.sx : 0, film.render ? film.sub.sy : 0);
    // shadow frustum follows what the camera looks at, sized by the scale of the shot
    camera.getWorldDirection(rig.tmp.f);
    const scale = camState.scale;
    // city shots: centre the shadow map on what the camera looks at and size it by that distance (wide aerials)
    const td = Math.min(camState.targetDist, 700);
    const reach = scale === 'city' ? Math.max(120, td) : scale === 'site' ? 16 : 5;
    const half = scale === 'city' ? Math.min(520, Math.max(230, td * 0.85)) : scale === 'site' ? 34 : 13;
    rig.tmp.c.copy(camera.position).addScaledVector(rig.tmp.f, reach);
    if (scale !== 'city') rig.tmp.c.y = Math.min(rig.tmp.c.y, 3);
    const sc = rig.sun.shadow.camera;
    if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; }
    const dist = scale === 'city' ? Math.max(700, half * 1.6) : 120;
    rig.sun.position.set(rig.tmp.c.x + rig.tmp.d.x * dist, rig.tmp.c.y + rig.tmp.d.y * dist, rig.tmp.c.z + rig.tmp.d.z * dist);
    rig.sun.target.position.copy(rig.tmp.c); rig.sun.target.updateMatrixWorld();
    sc.near = 1; sc.far = dist * 2;
    sc.updateProjectionMatrix();
    rig.sun.shadow.bias = scale === 'city' ? -0.0004 : -0.00015;
    rig.sun.shadow.normalBias = scale === 'city' ? 0.12 : 0.02;
    // keep the sky dome centred on the camera
    rig.gradient.position.copy(camera.position);
    rig.physical.position.copy(camera.position);
  });

  return (
    <>
      <primitive object={rig.sun} />
      <primitive object={rig.sun.target} />
      <primitive object={rig.fill} />
    </>
  );
}
