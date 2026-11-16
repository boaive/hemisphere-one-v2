import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { film, span } from '../film/clock';
import { SITE_ORIGIN } from '../film/shots';
import { track } from '../ui/loading';

/**
 * Rigged, animated humans from Blender (MPFB base -> glTF). Every clip is posed from film time (deterministic scrub).
 * Characters face +Z in their files; placements are site-local (the site group is rotated 180 deg).
 */
type Cast = {
  file: string; pos: [number, number, number]; ry: number;
  clip: (t: number) => { name: string; time: number } | null;   // which clip + time at film time t
  visible: (t: number) => boolean;
};
const loop = (name: string, speed = 1, offset = 0) => (t: number) => ({ name, time: (t * speed + offset) });

export const CAST: Record<string, Cast> = {
  builder: {
    file: '/models/humans/builder.glb', pos: [11.2, 0, 3.4], ry: -2.72,   // faces the house front
    clip: (t) => (t >= 50 ? { name: 'step_back_tablet', time: Math.min(t - 50, 4.2) } : { name: 'idle_inspect', time: t }),
    visible: (t) => t > 18.5,
  },
  shutter: { file: '/models/humans/worker_shutter.glb', pos: [-4.0, 0, 0.66], ry: Math.PI, clip: loop('place_panel', 1, 0.4), visible: (t) => t > 18.5 && t < 38.2 },
  mason: { file: '/models/humans/worker_mason.glb', pos: [2.3, 0, 0.78], ry: Math.PI, clip: loop('lay_brick', 1, 1.1), visible: (t) => t > 18.5 && t < 46.0 },
  plaster: { file: '/models/humans/worker_plaster.glb', pos: [5.9, 0, 0.74], ry: Math.PI, clip: loop('apply_plaster', 1, 0.2), visible: (t) => t > 18.5 && t < 46.8 },
  helper: { file: '/models/humans/worker_helper.glb', pos: [-5.1, 0, -0.95], ry: Math.PI / 2, clip: loop('idle', 1, 2), visible: (t) => t > 18.5 },
};

type Loaded = { root: THREE.Object3D; mixer: THREE.AnimationMixer; actions: Record<string, THREE.AnimationAction>; morphs: THREE.Mesh[]; cast: Cast; last?: string };

export function Humans() {
  const group = useMemo(() => {
    const g = new THREE.Group();
    g.position.set(...SITE_ORIGIN); g.rotation.y = Math.PI;
    return g;
  }, []);
  const loaded = useMemo<Loaded[]>(() => [], []);

  useEffect(() => {
    const draco = new DRACOLoader().setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    let alive = true;
    Object.values(CAST).forEach((c) => {
      // only load files that exist (characters arrive from the Blender pipeline independently)
      const done = track(c.file);
      fetch(c.file, { method: 'HEAD' }).then((res) => {
        if (!res.ok || !(res.headers.get('content-type') ?? '').match(/gltf|octet|binary/)) { done(); return; }
        loader.load(c.file, (gltf) => {
          done();
          if (!alive) return;
          const root = gltf.scene;
          root.position.set(...c.pos); root.rotation.y = c.ry;
          const morphs: THREE.Mesh[] = [];
          root.traverse((o) => {
            const m = o as THREE.Mesh;
            if (o.name.startsWith('CTX_')) { o.visible = false; return; }   // context props baked in the files; the scene supplies its own
            if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; if (m.morphTargetDictionary) morphs.push(m); }
          });
          const mixer = new THREE.AnimationMixer(root);
          const actions: Record<string, THREE.AnimationAction> = {};
          gltf.animations.forEach((clip) => { const a = mixer.clipAction(clip); a.play(); a.enabled = false; a.weight = 1; actions[clip.name] = a; });
          group.add(root);
          loaded.push({ root, mixer, actions, morphs, cast: c });
        }, undefined, () => done());
      }).catch(() => done());
    });
    return () => { alive = false; draco.dispose(); };
  }, [group, loaded]);

  useFrame(() => {
    const t = film.t;
    group.visible = t > 18.5;
    for (const L of loaded) {
      const vis = L.cast.visible(t);
      L.root.visible = vis;
      if (!vis) continue;
      const want = L.cast.clip(t);
      const names = Object.keys(L.actions);
      const name = want && L.actions[want.name] ? want.name : names[0];
      if (!name) continue;
      for (const n of names) L.actions[n].enabled = n === name;
      const a = L.actions[name];
      const dur = a.getClip().duration || 1;
      const time = want ? want.time : t;
      a.time = name.startsWith('step_back') ? Math.min(time, dur - 1e-3) : ((time % dur) + dur) % dur;
      L.mixer.update(0);
      // natural blinks: ~every 3.2-4.6 s, 140 ms; the builder's smile is baked in his clip (morph keys)
      const seed = L.cast.pos[0] * 1.7;
      const period = 3.2 + (Math.abs(Math.sin(seed)) * 1.4);
      const ph = ((t + seed) % period) / period;
      const blink = ph < 0.035 ? Math.sin((ph / 0.035) * Math.PI) : 0;
      const isBuilder = L.cast === CAST.builder;
      const reaction = isBuilder && t > 52.4 && t < 58.5;     // the 3/4 close-up: eyes must read open
      for (const m of L.morphs) {
        const i = m.morphTargetDictionary!['blink'];
        if (i !== undefined && m.morphTargetInfluences) m.morphTargetInfluences[i] = reaction ? 0 : blink;
        // restrained smile: cap the clip's smile so the eye squint stays subtle (cheeks lift, eyes stay open)
        const sm = m.morphTargetDictionary!['smile'];
        if (isBuilder && sm !== undefined && m.morphTargetInfluences) m.morphTargetInfluences[sm] = Math.min(m.morphTargetInfluences[sm], 0.42);
        const br = m.morphTargetDictionary!['brow_raise'];
        if (reaction && br !== undefined && m.morphTargetInfluences) m.morphTargetInfluences[br] = 0.18 * span(t, 52.8, 53.6);
        // subtle restrained smile only in shot 12 (in case the clip has no morph keys)
        const s = m.morphTargetDictionary!['smile'];
        if (s !== undefined && m.morphTargetInfluences && L.cast === CAST.builder && !L.actions['step_back_tablet']?.getClip().tracks.some((tr) => tr.name.includes('morphTargetInfluences')))
          m.morphTargetInfluences[s] = 0.55 * span(t, 52.6, 53.6);
      }
    }
  });

  return <primitive object={group} />;
}
