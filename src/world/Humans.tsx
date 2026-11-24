import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { film, span, smooth } from '../film/clock';
import { SITE_ORIGIN } from '../film/shots';
import { track } from '../ui/loading';

/**
 * The cast of films 2 and 3: one rigged construction worker (Mixamo "Ch17": hard hat, hi-vis vest, work trousers,
 * boots) instanced per role with motion-capture clips (render-assets/mixamo). Every pose is set from film / story
 * time, so any frame renders on its own. Placements are site-local (the site group is rotated 180 deg).
 * Render-only: the website plays the pre-rendered films and never loads these files.
 */
const CHAR = '/render-assets/mixamo/character.fbx';
const CLIPS = ['builder_tablet', 'builder_happy', 'builder_idle', 'worker_hands', 'worker_kneel', 'worker_place', 'worker_lift', 'worker_walk'] as const;
type ClipName = (typeof CLIPS)[number];
type Pose = { clip: ClipName; time: number; weight?: number; hold?: boolean };

type Role = {
  id: string; pos: [number, number]; ry: number; helmet?: string; shirt?: string; tablet?: boolean;
  visible: () => boolean;
  poses: () => Pose[];
  /** walkers move along a line at their clip's pace (root motion is stripped from the clip) */
  path?: { from: [number, number]; to: [number, number]; speed: number };
};

const s2 = () => film.scene === 2;
const s3 = () => film.scene === 3;
const loop = (clip: ClipName, offset = 0): (() => Pose[]) => () => [{ clip, time: film.t + offset }];

export const ROLES: Role[] = [
  // the conventional crew (film 2, and film 3 until the cuts after the wave)
  { id: 'carpenter', pos: [-3.3, 0.95], ry: -2.49, helmet: '#f2c230', shirt: '#cfd8e2', visible: () => s2() || (s3() && film.story < 38.3), poses: loop('worker_hands', 0.6) },
  { id: 'mason', pos: [2.2, 0.95], ry: Math.PI, visible: () => s2() || (s3() && film.story < 41), poses: loop('worker_place', 1.4) },
  { id: 'plasterer', pos: [6.4, 0.85], ry: Math.PI, helmet: '#f2c230', shirt: '#e3d6c6', visible: () => s2() || (s3() && film.story < 41), poses: loop('worker_kneel', 0.3) },
  { id: 'helper', pos: [-5.2, 3.3], ry: -2.41, helmet: '#3b6db3', visible: () => s2() || (s3() && film.story < 38.3), poses: loop('worker_lift', 2.2) },
  { id: 'walker', pos: [-8, 8.6], ry: Math.PI / 2, shirt: '#d7d0c4', visible: () => s2() || (s3() && film.story < 41), poses: loop('worker_walk'), path: { from: [-9, 8.6], to: [16, 8.6], speed: 1.25 } },
  // the builder: calm in film 2; in film 3 he holds the tablet the wave starts from, then settles, satisfied
  {
    id: 'builder', pos: [12.0, 6.2], ry: Math.PI, tablet: true, visible: () => film.scene !== 1,
    poses: () => {
      if (s2()) return [{ clip: 'builder_idle', time: film.t + 1.3 }];
      // he checks the tablet, then settles into a relaxed, contented stance
      const k = smooth(span(film.story, 52.4, 53.3));
      return [{ clip: 'builder_tablet', time: 3 + (film.story - 36.8), weight: 1 - k }, { clip: 'builder_idle', time: film.story - 52.4, weight: k }];
    },
  },
  // the new crew (film 3, after the wave): JET panels on the column, premix into the H1
  { id: 'jet-crew', pos: [-3.2, 1.05], ry: -2.49, helmet: '#f2c230', visible: () => s3() && film.story >= 38.3 && film.story < 45.9, poses: loop('worker_place', 0.2) },
  { id: 'operator', pos: [-8.0, -1.4], ry: 2.92, shirt: '#cfd8e2', visible: () => s3() && film.story >= 41, poses: loop('worker_place', 3.1) },
];

type Loaded = { role: Role; root: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Record<string, THREE.AnimationAction>; tablet?: THREE.Object3D };

/** FBX Phong -> PBR so the cast sits in the same light as the set */
function pbr(m: THREE.Material) {
  const p = m as THREE.MeshPhongMaterial;
  const s = new THREE.MeshStandardMaterial({ map: p.map ?? null, normalMap: p.normalMap ?? null, color: '#ffffff', roughness: 0.78, metalness: 0, transparent: p.transparent, alphaTest: p.transparent ? 0.4 : 0, side: p.transparent ? THREE.DoubleSide : THREE.FrontSide });
  if (s.transparent) { s.transparent = false; s.depthWrite = true; }
  return s;
}

export function Humans() {
  const group = useMemo(() => {
    const g = new THREE.Group();
    g.position.set(...SITE_ORIGIN); g.rotation.y = Math.PI;
    return g;
  }, []);
  const loaded = useMemo<Loaded[]>(() => [], []);

  useEffect(() => {
    let alive = true;
    const done = track(CHAR);
    (async () => {
      try {
        const base = await new FBXLoader().loadAsync(CHAR);
        const clips: Record<string, THREE.AnimationClip> = {};
        await Promise.all(CLIPS.map(async (n) => {
          const j = await fetch(`/render-assets/mixamo/clips/${n}.json`).then((r) => r.json());
          const c = THREE.AnimationClip.parse(j);
          if (n === 'worker_walk') {
            // strip horizontal root motion (the role's path moves the walker instead)
            const hp = c.tracks.find((t) => /Hips\.position$/.test(t.name));
            if (hp) for (let i = 0; i < hp.values.length; i += 3) { hp.values[i] = hp.values[0]; hp.values[i + 2] = hp.values[2]; }
          }
          clips[n] = c;
        }));
        if (!alive) return;
        // one shared PBR material set
        const matCache = new Map<THREE.Material, THREE.MeshStandardMaterial>();
        base.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.material = ([] as THREE.Material[]).concat(m.material).map((x) => { if (!matCache.has(x)) matCache.set(x, pbr(x)); return matCache.get(x)!; }) as unknown as THREE.Material;
          if (Array.isArray(m.material) && m.material.length === 1) m.material = m.material[0];
        });
        const tabletGeo = new THREE.BoxGeometry(17, 24, 1.1);
        const tabletMat = [new THREE.MeshStandardMaterial({ color: '#2a2e33', roughness: 0.4, metalness: 0.5 })];
        const screenMat = new THREE.MeshStandardMaterial({ color: '#0d1b2a', emissive: new THREE.Color('#2a6fb5'), emissiveIntensity: 0.55, roughness: 0.15 });
        for (const role of ROLES) {
          const root = SkeletonUtils.clone(base);
          root.scale.setScalar(0.01);
          root.position.set(role.pos[0], 0, role.pos[1]);
          root.rotation.y = role.ry;
          root.traverse((o) => {
            const m = o as THREE.Mesh;
            if (!m.isMesh) return;
            m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
            const tint = /Helmet/i.test(m.name) ? role.helmet : /Shirt/i.test(m.name) ? role.shirt : undefined;
            if (tint) { const c = (m.material as THREE.MeshStandardMaterial).clone(); c.color.set(tint); m.material = c; }
          });
          const mixer = new THREE.AnimationMixer(root);
          const actions: Record<string, THREE.AnimationAction> = {};
          for (const n of CLIPS) { const a = mixer.clipAction(clips[n]); a.play(); a.enabled = false; actions[n] = a; }
          let tablet: THREE.Object3D | undefined;
          if (role.tablet) {
            const hand = root.getObjectByName('mixamorig1LeftHand') ?? root.getObjectByName('mixamorigLeftHand');
            if (hand) {
              tablet = new THREE.Group();
              const body = new THREE.Mesh(tabletGeo, tabletMat[0]); body.castShadow = true;
              const screen = new THREE.Mesh(new THREE.PlaneGeometry(15.4, 21.6), screenMat); screen.position.z = 0.56;
              tablet.add(body, screen);
              tablet.position.set(0, 9, 3); tablet.rotation.set(1.0, 0, 0);   // held in front, screen tilted up to his eyes
              hand.add(tablet);
            }
          }
          group.add(root);
          loaded.push({ role, root, mixer, actions, tablet });
        }
      } finally { done(); }
    })();
    return () => { alive = false; };
  }, [group, loaded]);

  useFrame(() => {
    group.visible = film.scene !== 1;
    if (!group.visible) return;
    for (const L of loaded) {
      const vis = L.role.visible();
      L.root.visible = vis;
      if (!vis) continue;
      if (L.role.path) {
        const { from, to, speed } = L.role.path;
        const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
        const u = ((film.t * speed) % len) / len;
        L.root.position.set(from[0] + (to[0] - from[0]) * u, 0, from[1] + (to[1] - from[1]) * u);
      }
      const poses = L.role.poses();
      for (const n of CLIPS) L.actions[n].enabled = false;
      for (const p of poses) {
        const a = L.actions[p.clip];
        const dur = a.getClip().duration || 1;
        a.enabled = true;
        a.setEffectiveWeight(p.weight ?? 1);
        a.time = p.hold ? Math.min(Math.max(0, p.time), dur - 0.01) : ((p.time % dur) + dur) % dur;
      }
      L.mixer.update(0);
      if (L.tablet) L.tablet.visible = film.scene === 3;
    }
  });

  return <primitive object={group} />;
}
