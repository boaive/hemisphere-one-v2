import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { film, span, smooth } from '../film/clock';
import { S, SITE_CENTRE, PRECAST, FACTORY } from '../film/shots';
import { BRAND } from './materials';
import { rand } from './geo';
import { anchor } from './anchors';

/**
 * 54-58 s: the ecosystem grows out of the transformed site. Thin architectural links (not a glowing globe):
 * each arc draws from the site to a node; nodes are small rings on real rooftops.
 */
export const ECOSYSTEM = [
  { id: 'eco-machinery', label: 'Machinery' },
  { id: 'eco-formwork', label: 'Formwork' },
  { id: 'eco-reinforcement', label: 'Reinforcement' },
  { id: 'eco-concrete', label: 'Concrete' },
  { id: 'eco-solutions', label: 'Solutions' },
];

const lineVS = `
  attribute float aT;
  varying float vT;
  void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const lineFS = `
  uniform float uP; uniform vec3 uA; uniform vec3 uB; uniform float uO;
  varying float vT;
  void main(){
    if (vT > uP) discard;
    float head = smoothstep(uP - 0.06, uP, vT);
    vec3 c = mix(uA, uB, vT);
    gl_FragColor = vec4(c * (0.9 + head * 1.6), uO * (0.55 + 0.45 * head));
  }`;

export function Network() {
  const net = useMemo(() => {
    const g = new THREE.Group();
    const r = rand(55);
    const origin = new THREE.Vector3(SITE_CENTRE[0], 7.5, SITE_CENTRE[2]);
    const targets: { p: THREE.Vector3; delay: number; label?: string }[] = [];
    // the five labelled ecosystem nodes on everyday projects around the site
    const ring = [[-140, 60], [-60, 180], [110, 140], [190, -40], [70, -190]];
    ring.forEach(([dx, dz], i) => targets.push({ p: new THREE.Vector3(origin.x + dx, 9 + r() * 5, origin.z + dz), delay: 0.25 + i * 0.12, label: ECOSYSTEM[i].id }));
    // more everyday sites across the fringe
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = 120 + r() * 420;
      targets.push({ p: new THREE.Vector3(origin.x + Math.cos(a) * d, 8 + r() * 5, origin.z + Math.sin(a) * d * 0.8 - 60), delay: 0.6 + r() * 1.3 });
    }
    // and back into the advanced district: the giants are part of the same network now
    targets.push({ p: new THREE.Vector3(0, 124, 0), delay: 1.0 }, { p: new THREE.Vector3(PRECAST.x, 34, PRECAST.z), delay: 1.1 }, { p: new THREE.Vector3((FACTORY.x0 + FACTORY.x1) / 2, 16, (FACTORY.z0 + FACTORY.z1) / 2), delay: 1.2 });

    const arcs = targets.map((tg) => {
      const mid = origin.clone().lerp(tg.p, 0.5); mid.y += 18 + origin.distanceTo(tg.p) * 0.12;
      const curve = new THREE.QuadraticBezierCurve3(origin.clone(), mid, tg.p);
      const geo = new THREE.TubeGeometry(curve, 64, tg.label ? 0.32 : 0.22, 5, false);
      const pos = geo.getAttribute('position');
      const aT = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) aT[i] = Math.floor(i / 6) / 64;
      geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
      const m = new THREE.ShaderMaterial({
        vertexShader: lineVS, fragmentShader: lineFS, transparent: true, depthWrite: false, toneMapped: false,
        uniforms: { uP: { value: 0 }, uA: { value: new THREE.Color(BRAND.green) }, uB: { value: new THREE.Color(BRAND.blue) }, uO: { value: 1 } },
      });
      const line = new THREE.Mesh(geo, m); g.add(line);
      const node = new THREE.Mesh(new THREE.TorusGeometry(tg.label ? 2.2 : 1.3, tg.label ? 0.22 : 0.15, 6, 40).rotateX(Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: tg.label ? BRAND.yellow : BRAND.green, transparent: true, toneMapped: false }));
      node.position.copy(tg.p); g.add(node);
      return { m, node, delay: tg.delay, label: tg.label, p: tg.p };
    });
    // the origin: a precise ring around the transformed house
    const originRing = new THREE.Mesh(new THREE.TorusGeometry(9, 0.14, 6, 96).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: BRAND.green, transparent: true, toneMapped: false }));
    originRing.position.set(SITE_CENTRE[0], 0.2, SITE_CENTRE[2]); g.add(originRing);
    return { g, arcs, originRing };
  }, []);

  useFrame(() => {
    const t = film.t;
    const live = t > 54;
    net.g.visible = live;
    if (!live) return;
    const base = 54.3;
    net.originRing.scale.setScalar(0.4 + 0.6 * smooth(span(t, 54.2, 55.0)));
    (net.originRing.material as THREE.MeshBasicMaterial).opacity = smooth(span(t, 54.2, 54.6));
    for (const a of net.arcs) {
      const p = smooth(span(t, base + a.delay, base + a.delay + 1.6));
      a.m.uniforms.uP.value = p;
      a.node.visible = p > 0.98;
      (a.node.material as THREE.MeshBasicMaterial).opacity = smooth(span(t, base + a.delay + 1.5, base + a.delay + 1.9));
      if (a.label) anchor(a.label, a.p.x, a.p.y + 4, a.p.z);
    }
  });
  return <primitive object={net.g} />;
}
void S;
