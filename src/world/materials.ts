import * as THREE from 'three';
import { brushed, concrete, earth, plywood, ribbedPanel, withRepeat, curtainWall, houseFacade, lattice } from './textures';

/**
 * Shared PBR materials. Physically plausible values only - no chrome aluminium, no glossy concrete.
 * Site materials get the Hemisphere One transformation wave patched in (see `WAVE`).
 */
export const BRAND = {
  yellow: '#FCD301', ink: '#0F1A20', paper: '#F7F4EB', graphite: '#2A3137', blue: '#3FB7E8',
};

// ------------------------------------------------------------------ the transformation wave (shared uniforms)
export const WAVE = {
  uWaveOrigin: { value: new THREE.Vector3(0, 0, 0) },
  uWaveR: { value: -10 },              // front radius (m); negative = inactive
  uWaveW: { value: 0.45 },             // front thickness
  uWaveA: { value: new THREE.Color(BRAND.yellow).multiplyScalar(1.0) },
  uWaveB: { value: new THREE.Color(BRAND.blue).multiplyScalar(1.0) },
  uWaveStrength: { value: 0 },
  uTrace: { value: 0 },                // separate scalar for machine/trace highlights
};

export function patchWave<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, WAVE);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWavePos;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 wvp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wvp = instanceMatrix * wvp;
        #endif
        vWavePos = (modelMatrix * wvp).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWavePos;
        uniform vec3 uWaveOrigin; uniform float uWaveR; uniform float uWaveW;
        uniform vec3 uWaveA; uniform vec3 uWaveB; uniform float uWaveStrength;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float wd = distance(vWavePos.xz, uWaveOrigin.xz) + abs(vWavePos.y - uWaveOrigin.y) * 0.35;
          float front = 1.0 - smoothstep(0.0, uWaveW, abs(wd - uWaveR));
          float lead = 1.0 - smoothstep(0.0, uWaveW * 0.25, abs(wd - uWaveR));
          // geometric edge emphasis: the front catches arrises and joints (screen-space normal change)
          vec3 nrm = normalize(cross(dFdx(vWavePos), dFdy(vWavePos)));
          float edge = clamp(length(fwidth(nrm)) * 6.0, 0.0, 1.0);
          float trail = (1.0 - smoothstep(0.0, 3.5, uWaveR - wd)) * step(wd, uWaveR) * 0.12;
          vec3 wc = mix(uWaveB, uWaveA, smoothstep(-uWaveW, uWaveW, uWaveR - wd));
          totalEmissiveRadiance += wc * (front * (0.55 + 1.6 * edge) + lead * 1.2 + trail) * uWaveStrength;
        }`);
  };
  m.customProgramCacheKey = () => 'wave' + m.type;
  return m;
}

// ------------------------------------------------------------------ Scene 1 "digital ripple" (shared uniforms)
/**
 * Data ripples across the district while it assembles: thin wavefronts expand from each project, light the
 * geometry's edges and reveal a fine metric grid inside the front. xyz = origin, w = radius (negative = off).
 */
export const SCAN = {
  uRip: { value: [new THREE.Vector4(0, 0, 0, -1), new THREE.Vector4(0, 0, 0, -1), new THREE.Vector4(0, 0, 0, -1), new THREE.Vector4(0, 0, 0, -1)] },
  uRipW: { value: 7.0 },
  uScanColor: { value: new THREE.Color('#3FB7E8') },
  uScanStrength: { value: 0 },
};
const SCAN_GLSL = /* glsl */ `
  {
    vec3 sp = vScanPos;
    vec3 sn = normalize(cross(dFdx(sp), dFdy(sp)));
    float sedge = clamp(length(fwidth(sn)) * 5.0, 0.0, 1.0);
    // metric grid (3 m plan, floor-height verticals), anti-aliased
    vec3 gq = abs(fract(sp / vec3(3.0, 3.1, 3.0) - 0.5) - 0.5) / max(fwidth(sp / vec3(3.0, 3.1, 3.0)), vec3(1e-4));
    float sgrid = 1.0 - clamp(min(min(gq.x, gq.y), gq.z) - 0.35, 0.0, 1.0);
    float sacc = 0.0;
    for (int i = 0; i < 4; i++) {
      vec4 r = uRip[i];
      if (r.w < 0.0) continue;
      float d = distance(sp.xz, r.xz);
      float front = 1.0 - smoothstep(0.0, uRipW, abs(d - r.w));
      float lead = 1.0 - smoothstep(0.0, uRipW * 0.18, abs(d - r.w));
      float fade = 1.0 - smoothstep(180.0, 320.0, r.w);
      sacc += (front * (0.18 + 0.9 * sedge + 0.75 * sgrid) + lead * 0.35) * fade;
    }
    totalEmissiveRadiance += uScanColor * sacc * uScanStrength * uScanGain;
  }`;

export function patchScan<T extends THREE.Material>(m: T, gain = 1): T {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SCAN, { uScanGain: { value: gain } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vScanPos;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 svp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          svp = instanceMatrix * svp;
        #endif
        vScanPos = (modelMatrix * svp).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vScanPos;
        uniform vec4 uRip[4]; uniform float uRipW; uniform vec3 uScanColor; uniform float uScanStrength; uniform float uScanGain;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${SCAN_GLSL}`);
  };
  m.customProgramCacheKey = () => 'scan' + m.type + gain;
  return m;
}

/**
 * World-space planar UVs for scaled instanced buildings: windows keep real size whatever the instance scale.
 * su/sv = metres per texture tile horizontally / vertically.
 */
export function patchWorldUV<T extends THREE.Material>(m: T, su: number, sv: number): T {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      {
        vec4 wq = vec4(transformed, 1.0);
        mat3 nm = mat3(modelMatrix);
        #ifdef USE_INSTANCING
          wq = instanceMatrix * wq; nm = nm * mat3(instanceMatrix);
        #endif
        wq = modelMatrix * wq;
        vec3 wn = normalize(nm * objectNormal);
        vec2 puv = abs(wn.y) > 0.5 ? wq.xz : (abs(wn.x) > abs(wn.z) ? wq.zy : wq.xy);
        #ifdef USE_MAP
          vMapUv = puv / vec2(${su.toFixed(3)}, ${sv.toFixed(3)});
        #endif
      }`);
  };
  m.customProgramCacheKey = () => `wuv${su}_${sv}`;
  return m;
}

type StdOpts = THREE.MeshStandardMaterialParameters & { wave?: boolean; scan?: boolean | number };
const std = (o: StdOpts) => {
  const { wave, scan, ...rest } = o;
  const m = new THREE.MeshStandardMaterial(rest);
  return wave ? patchWave(m) : scan ? patchScan(m, scan === true ? 1 : scan) : m;
};
const phys = (o: THREE.MeshPhysicalMaterialParameters & { scan?: boolean | number }) => {
  const { scan, ...rest } = o;
  const m = new THREE.MeshPhysicalMaterial(rest);
  return scan ? patchScan(m, scan === true ? 1 : scan) : m;
};

/** white-model surfaces: keep normal + roughness relief, drop the albedo map (colour comes from `color`) */
const relief = (p: { map: THREE.Texture; roughnessMap: THREE.Texture; normalMap: THREE.Texture }) => ({ roughnessMap: p.roughnessMap, normalMap: p.normalMap });

let M: ReturnType<typeof build> | null = null;
export const mats = () => (M ??= build());

function build() {
  const conc = concrete(3);
  const concTie = concrete(4, true);
  const ply = plywood(5);
  const alu = brushed(7);
  const rib = ribbedPanel();
  const soil = earth(13);
  const paved = earth(17, true);
  return {
    // structure (Scene 1 district: near-white precision-model palette, with the digital ripple patched in)
    concrete: std({ ...relief(withRepeat(conc, 0.25)), color: '#e2dfd9', roughness: 0.9, normalScale: new THREE.Vector2(0.4, 0.4), scan: true }),
    concreteTower: std({ ...relief(withRepeat(concTie, 0.6, 0.35)), color: '#ebe8e2', roughness: 0.86, normalScale: new THREE.Vector2(0.45, 0.45), scan: true }),
    concreteSite: std({ ...withRepeat(conc, 0.5), color: '#b3aca0', roughness: 0.95, normalScale: new THREE.Vector2(0.5, 0.5), wave: true }),
    concreteNew: std({ ...withRepeat(concTie, 0.8, 0.5), color: '#d6d2c9', roughness: 0.72, normalScale: new THREE.Vector2(0.35, 0.35), wave: true }),
    wetConcrete: std({ color: '#6f6d68', roughness: 0.18, metalness: 0 }),
    aluminium: std({ ...withRepeat(alu, 1, 1), color: '#e4e9ee', metalness: 0.62, roughness: 0.32, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 1.6, scan: 0.7 }),
    zinc: std({ color: '#c3c8cc', metalness: 1, roughness: 0.38 }),
    steelGalv: std({ color: '#a7adb2', metalness: 0.9, roughness: 0.45 }),
    steelPrimer: std({ color: '#7f878e', metalness: 0.5, roughness: 0.48, scan: 0.7 }),
    steelYellowCrane: std({ color: BRAND.yellow, metalness: 0.2, roughness: 0.45 }),
    rebar: std({ color: '#6c4632', metalness: 0.55, roughness: 0.78, wave: true }),
    rebarDistrict: std({ color: '#8a8f93', metalness: 0.6, roughness: 0.6 }),
    panelWall: std({ ...withRepeat(rib, 1, 1), color: '#f0f1f2', metalness: 0.25, roughness: 0.42, scan: true }),
    panelRoof: std({ ...withRepeat(rib, 1, 1), color: '#e4e7ea', metalness: 0.3, roughness: 0.46, scan: true }),
    glassDistrict: phys({ color: '#3f5872', metalness: 0.1, roughness: 0.04, reflectivity: 0.7, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.5, scan: 0.7 }),
    glassReal: phys({ color: '#4d6c7c', metalness: 0.1, roughness: 0.05, reflectivity: 0.7, clearcoat: 1, envMapIntensity: 1.4 }),
    concreteReal: std({ ...withRepeat(conc, 0.3), color: '#c7c3bb', roughness: 0.9, normalScale: new THREE.Vector2(0.5, 0.5) }),
    siteGround: std({ ...withRepeat(paved, 110), color: '#d2cdc3', roughness: 1, normalScale: new THREE.Vector2(0.45, 0.45) }),
    roadReal: std({ ...withRepeat(paved, 140), color: '#6d6f72', roughness: 0.88, normalScale: new THREE.Vector2(0.2, 0.2) }),
    groundDistrict: std({ ...relief(withRepeat(paved, 260)), color: '#d6d5d1', roughness: 0.95, normalScale: new THREE.Vector2(0.12, 0.12), scan: 0.35 }),
    roadDistrict: std({ ...relief(withRepeat(paved, 200)), color: '#c4c3bf', roughness: 0.9, normalScale: new THREE.Vector2(0.12, 0.12) }),
    modelTree: std({ color: '#cdd6c6', roughness: 0.9 }),
    deckAlu: std({ ...withRepeat(alu, 1, 1), color: '#c9d0d6', metalness: 0.25, roughness: 0.5, normalScale: new THREE.Vector2(0.2, 0.2), scan: true }),
    slabMesh: std({ color: '#6e5a4c', metalness: 0.5, roughness: 0.7, alphaTest: 0.5, side: THREE.DoubleSide }),
    precast: std({ ...withRepeat(conc, 0.4), color: '#ecebe6', roughness: 0.8, normalScale: new THREE.Vector2(0.35, 0.35), scan: 0.7 }),
    cladding: std({ color: '#c9cdd1', roughness: 0.4, metalness: 0.55, scan: 0.7 }),
    claddingDark: std({ color: '#3e454c', roughness: 0.45, metalness: 0.5, scan: 0.7 }),
    glass: phys({ color: '#1e2c36', metalness: 0, roughness: 0.04, reflectivity: 0.6, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.2 }),
    curtain: phys({ map: curtainWall(), color: '#ffffff', metalness: 0.1, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.35 }),
    // traditional site
    plywood: std({ ...withRepeat(ply, 1, 1), roughness: 0.9, wave: true }),
    timber: std({ ...withRepeat(ply, 0.5, 2), color: '#c9a77e', roughness: 0.85, wave: true }),
    brick: std({ color: '#ffffff', roughness: 0.92, wave: true }),   // tinted per instance
    mortar: std({ ...withRepeat(conc, 2), color: '#b9ae9b', roughness: 1, wave: true }),
    plaster: std({ ...withRepeat(conc, 1.5), color: '#c8bfaf', roughness: 0.95, wave: true }),
    plasterWet: std({ ...withRepeat(conc, 1.5), color: '#8f887d', roughness: 0.55 }),
    propRust: std({ color: '#7a5a46', metalness: 0.6, roughness: 0.7, wave: true }),
    bamboo: std({ color: '#b89b64', roughness: 0.6, wave: true }),
    sand: std({ ...withRepeat(soil, 1.2), color: '#f2e2c8', roughness: 1, normalScale: new THREE.Vector2(0.5, 0.5) }),
    aggregate: std({ ...withRepeat(paved, 6), color: '#8c8780', roughness: 1 }),
    cementBag: std({ color: '#d9d2c1', roughness: 0.95 }),
    premixBag: std({ color: '#f4f1e8', roughness: 0.8, wave: true }),
    drum: std({ color: '#1f4e8c', roughness: 0.42 }),
    earth: std({ ...withRepeat(soil, 60), roughness: 1, normalScale: new THREE.Vector2(0.4, 0.4) }),
    paved: std({ ...withRepeat(paved, 120), color: '#bdbab4', roughness: 0.95, normalScale: new THREE.Vector2(0.2, 0.2) }),
    asphalt: std({ ...withRepeat(paved, 200), color: '#8f8579', roughness: 0.92, normalScale: new THREE.Vector2(0.15, 0.15) }),
    groundCity: std({ ...withRepeat(paved, 400), color: '#9b978f', roughness: 0.95 }),
    // Hemisphere One products
    jet: std({ color: BRAND.graphite, roughness: 0.5, metalness: 0.05, wave: true }),   // formwork in graphite (no green, per brief)
    jetClip: std({ color: '#22272b', roughness: 0.5, wave: true }),
    h1Yellow: std({ color: BRAND.yellow, roughness: 0.35, metalness: 0.1, wave: true }),
    h1Charcoal: std({ color: '#2b2f33', roughness: 0.45, metalness: 0.25, wave: true }),
    steel: std({ color: '#9aa0a5', metalness: 1, roughness: 0.35, wave: true }),
    tyre: std({ color: '#151617', roughness: 0.85 }),
    // fringe
    house: [0, 1, 2, 3].map((i) => patchWorldUV(std({ map: houseFacade(30 + i), color: ['#d9cdb8', '#cfa596', '#a9bfa8', '#a4b9c6'][i], roughness: 0.9 }), 6, 6.2)),
    roof: std({ ...withRepeat(conc, 0.3), color: '#9c958b', roughness: 0.95 }),
    tank: std({ color: '#121314', roughness: 0.55 }),
    trunk: std({ color: '#6a5a48', roughness: 0.9 }),
    frond: std({ color: '#4c6a2e', roughness: 0.65, side: THREE.DoubleSide }),
    canopy: std({ color: '#3f5a2e', roughness: 0.8 }),
    wire: std({ color: '#171717', roughness: 0.5 }),
    pole: std({ ...withRepeat(conc, 0.3), color: '#a9a49b', roughness: 0.9 }),
    lattice: std({ color: BRAND.yellow, roughness: 0.5, metalness: 0.2, alphaMap: lattice(), alphaTest: 0.5, side: THREE.DoubleSide }),
    screen: std({ color: '#eef0f1', roughness: 0.8, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    /** background city in Scene 1: white massing models (window rhythm comes from a world-scaled facade map) */
    massing: std({ color: '#eceeef', roughness: 0.82 }),
  };
}
export type Mats = ReturnType<typeof build>;
