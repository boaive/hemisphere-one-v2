import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { film, span, smooth, seat } from '../film/clock';
import { SITE_CENTRE, NODES } from '../film/shots';
import { BRAND, mats } from './materials';
import { rbox, merge, place, mesh, mat, instanced } from './geo';
import { moduleGeometry, MW, MH, MD } from './Precast';
import { anchor } from './anchors';

/**
 * The finale of film 3 (story 54-61): the bridge spreads. Thin arcs fly from the transformed site to eight
 * everyday plots across the town; where each arc lands, a modern site builds itself: JET-formwork houses,
 * precast module stacks set by telescopic cranes, panelized halls closing in. "Here and there", not everywhere.
 */
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
    gl_FragColor = vec4(c * (1.25 + head * 2.0), uO * (0.75 + 0.25 * head));
  }`;
const BASE = 54.4;

type Part = { o: THREE.Object3D; t0: number; dur: number; mode: 'grow' | 'drop' | 'fade' };

/** telescopic mobile crane: carrier, slewing cab, three nested boom sections and a hook line */
function teleCrane(M: ReturnType<typeof mats>, ang: number, ext: number, hookY: number) {
  const o = new THREE.Group();
  o.add(mesh(merge([place(rbox(2.6, 1.3, 10.5, 0.08), 0, 1.35, 0), place(rbox(2.5, 1.6, 2.2, 0.14), 0, 2.4, 4.4)]), M.steelYellowCrane));
  o.add(instanced(new THREE.CylinderGeometry(0.6, 0.6, 0.5, 16).rotateZ(Math.PI / 2), M.tyre, [-3.6, -2, 2.2, 3.8].flatMap((z) => [mat(-1.35, 0.6, z), mat(1.35, 0.6, z)])));
  const up = new THREE.Group(); up.position.set(0, 2.2, -1.8); o.add(up);
  up.add(mesh(rbox(2.6, 1.6, 3.8, 0.1), M.steelYellowCrane));
  const boom = new THREE.Group(); boom.position.set(0, 1.0, 1.4); boom.rotation.x = -ang; up.add(boom);
  const lens = [12, 10, 8.5], ths = [0.95, 0.78, 0.62], starts = [0, 12 * 0.92, 12 * 0.92 + 10 * ext];
  lens.forEach((len, i) => { const sct = mesh(new THREE.BoxGeometry(ths[i], ths[i] * 0.9, len).translate(0, 0, len / 2), M.steelYellowCrane); sct.position.z = starts[i]; boom.add(sct); });
  const tipL = starts[2] + lens[2];
  const tipY = 2.2 + 1.0 + Math.sin(ang) * tipL, tipZ = -1.8 + 1.4 + Math.cos(ang) * tipL;
  const ln = mesh(new THREE.CylinderGeometry(0.03, 0.03, Math.max(0.5, tipY - hookY), 5), M.wire, false);
  ln.position.set(0, (tipY + hookY) / 2, tipZ); o.add(ln);
  return { o, tip: new THREE.Vector3(0, tipY, tipZ) };
}

export function Network() {
  const M = mats();
  const net = useMemo(() => {
    const g = new THREE.Group();
    const origin = new THREE.Vector3(SITE_CENTRE[0], 7.5, SITE_CENTRE[2]);
    const parts: Part[] = [];
    const concrete = new THREE.MeshStandardMaterial({ color: '#dcd8d0', roughness: 0.85 });
    const white = new THREE.MeshStandardMaterial({ color: '#eeece7', roughness: 0.7 });
    const glass = new THREE.MeshPhysicalMaterial({ color: '#3d5568', roughness: 0.08, metalness: 0.2, clearcoat: 1 });
    const darkPanel = new THREE.MeshStandardMaterial({ color: '#30353b', metalness: 0.45, roughness: 0.4 });
    const lightPanel = new THREE.MeshStandardMaterial({ color: '#d0d3d6', metalness: 0.35, roughness: 0.4 });
    const steel = new THREE.MeshStandardMaterial({ color: '#4d5560', metalness: 0.6, roughness: 0.45 });
    const modGeo = moduleGeometry();

    const arcs = NODES.map((n, i) => {
      const p = new THREE.Vector3(origin.x + n.dx, 1, origin.z + n.dz);
      const delay = 0.15 + i * 0.32;
      const land = BASE + delay + 1.5;
      // the arc
      const top = new THREE.Vector3(p.x, 6, p.z);
      const mid = origin.clone().lerp(top, 0.5); mid.y += 16 + origin.distanceTo(top) * 0.14;
      const curve = new THREE.QuadraticBezierCurve3(origin.clone(), mid, top);
      const geo = new THREE.TubeGeometry(curve, 64, 0.42, 5, false);
      const pos = geo.getAttribute('position');
      const aT = new Float32Array(pos.count);
      for (let k = 0; k < pos.count; k++) aT[k] = Math.floor(k / 6) / 64;
      geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
      const m = new THREE.ShaderMaterial({
        vertexShader: lineVS, fragmentShader: lineFS, transparent: true, depthWrite: false, toneMapped: false,
        uniforms: { uP: { value: 0 }, uA: { value: new THREE.Color(BRAND.yellow) }, uB: { value: new THREE.Color(BRAND.blue) }, uO: { value: 1 } },
      });
      g.add(new THREE.Mesh(geo, m));
      // landing ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 64).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: BRAND.yellow, transparent: true, toneMapped: false }));
      ring.position.set(p.x, 0.25, p.z); g.add(ring);
      // the site that builds where the arc lands
      const site = new THREE.Group(); site.position.copy(p).setY(0); site.rotation.y = n.ry; site.scale.setScalar(1.45); g.add(site);
      const padM = mesh(new THREE.BoxGeometry(30, 0.1, 26), new THREE.MeshStandardMaterial({ color: '#c9c5bd', roughness: 0.9 }), false); padM.receiveShadow = true; site.add(padM);
      parts.push({ o: padM, t0: land - 0.1, dur: 0.5, mode: 'fade' });
      if (n.kind === 'jet') {
        // ground floor cast monolithic, first floor in green JET forms, a mixer beside
        const gf = mesh(merge([place(rbox(11, 3.1, 0.2, 0.01), 0, 1.55, 4), place(rbox(11, 3.1, 0.2, 0.01), 0, 1.55, -4), place(rbox(0.2, 3.1, 8, 0.01), 5.5, 1.55, 0), place(rbox(0.2, 3.1, 8, 0.01), -5.5, 1.55, 0), place(rbox(11.4, 0.2, 8.4, 0.01), 0, 3.2, 0)]), concrete);
        site.add(gf); parts.push({ o: gf, t0: land, dur: 0.9, mode: 'grow' });
        const forms = mesh(merge([place(rbox(11.2, 2.9, 0.12, 0.01), 0, 4.75, 4.1), place(rbox(11.2, 2.9, 0.12, 0.01), 0, 4.75, -4.1), place(rbox(0.12, 2.9, 8.2, 0.01), 5.6, 4.75, 0), place(rbox(0.12, 2.9, 8.2, 0.01), -5.6, 4.75, 0)]), M.jet);
        forms.position.y = 0; site.add(forms); parts.push({ o: forms, t0: land + 0.7, dur: 0.9, mode: 'grow' });
        const mixer = mesh(rbox(2.0, 1.4, 1.2, 0.1), M.steelYellowCrane); mixer.position.set(8.5, 0.7, 2); site.add(mixer); parts.push({ o: mixer, t0: land + 0.3, dur: 0.5, mode: 'grow' });
      } else if (n.kind === 'precast') {
        // three modules wide, three high; the last one is lowered by a telescopic crane
        const slots: THREE.Vector3[] = [];
        for (let lv = 0; lv < 3; lv++) for (let c = 0; c < 3; c++) slots.push(new THREE.Vector3(-MW + c * MW, lv * MH, 0));
        slots.forEach((sp, k) => {
          const last = k === slots.length - 1;
          const mo = mesh(modGeo, M.precast); mo.position.copy(sp); site.add(mo);
          parts.push({ o: mo, t0: last ? land + 1.9 : land + k * 0.16, dur: last ? 1.6 : 0.4, mode: 'drop' });
          const gw = mesh(new THREE.BoxGeometry(2.2, 1.3, 0.04), glass, false); gw.position.set(sp.x, sp.y + 1.75, MD / 2 + 0.02); site.add(gw);
          parts.push({ o: gw, t0: last ? land + 3.5 : land + k * 0.16 + 0.3, dur: 0.3, mode: 'fade' });
        });
        const cr = teleCrane(M, 0.95, 0.85, 3 * MH + 4); cr.o.position.set(12, 0, 6); cr.o.rotation.y = -Math.PI / 2 - 0.5; site.add(cr.o);
        parts.push({ o: cr.o, t0: land + 0.2, dur: 0.6, mode: 'fade' });
      } else {
        // panelized hall: steel frame, then wall panels close in course by course
        const fr: THREE.BufferGeometry[] = [];
        for (let x = -11; x <= 11.01; x += 5.5) for (const z of [-6, 6]) fr.push(place(new THREE.BoxGeometry(0.3, 7, 0.3), x, 3.5, z));
        fr.push(place(new THREE.BoxGeometry(22.3, 0.4, 0.3), 0, 7, -6), place(new THREE.BoxGeometry(22.3, 0.4, 0.3), 0, 7, 6), place(new THREE.BoxGeometry(0.3, 0.4, 12.3), -11, 7, 0), place(new THREE.BoxGeometry(0.3, 0.4, 12.3), 11, 7, 0));
        const frame = mesh(merge(fr), steel); site.add(frame); parts.push({ o: frame, t0: land, dur: 0.7, mode: 'grow' });
        const low = mesh(merge([place(rbox(22.2, 3.2, 0.18, 0.01), 0, 1.6, 6.1), place(rbox(22.2, 3.2, 0.18, 0.01), 0, 1.6, -6.1), place(rbox(0.18, 3.2, 12.2, 0.01), 11.1, 1.6, 0), place(rbox(0.18, 3.2, 12.2, 0.01), -11.1, 1.6, 0)]), darkPanel);
        site.add(low); parts.push({ o: low, t0: land + 0.6, dur: 0.8, mode: 'grow' });
        const up = mesh(merge([place(rbox(22.2, 3.8, 0.18, 0.01), 0, 5.1, 6.1), place(rbox(22.2, 3.8, 0.18, 0.01), 0, 5.1, -6.1), place(rbox(0.18, 3.8, 12.2, 0.01), 11.1, 5.1, 0), place(rbox(0.18, 3.8, 12.2, 0.01), -11.1, 5.1, 0)]), lightPanel);
        site.add(up); parts.push({ o: up, t0: land + 1.3, dur: 0.9, mode: 'grow' });
        const roof = mesh(rbox(22.4, 0.25, 12.4, 0.01), new THREE.MeshStandardMaterial({ color: '#5b6066', roughness: 0.8 })); roof.position.y = 7.2; site.add(roof); parts.push({ o: roof, t0: land + 2.0, dur: 0.6, mode: 'fade' });
        const cr = teleCrane(M, 0.85, 0.7, 8.5); cr.o.position.set(-15, 0, -2); cr.o.rotation.y = Math.PI / 2 + 0.4; site.add(cr.o);
        parts.push({ o: cr.o, t0: land + 0.3, dur: 0.6, mode: 'fade' });
      }
      void white;
      return { m, ring, delay, land, p, label: n.label };
    });
    // the origin: a precise ring around the transformed house
    const originRing = new THREE.Mesh(new THREE.TorusGeometry(9, 0.14, 6, 96).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: BRAND.yellow, transparent: true, toneMapped: false }));
    originRing.position.set(SITE_CENTRE[0], 0.2, SITE_CENTRE[2]); g.add(originRing);
    g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !(m.material as THREE.Material).transparent) { m.castShadow = true; m.receiveShadow = true; } });
    return { g, arcs, originRing, parts };
  }, [M]);

  useFrame(() => {
    const t = film.story;
    const live = film.scene === 3 && t > 54;
    net.g.visible = live;
    if (!live) return;
    net.originRing.scale.setScalar(0.4 + 0.6 * smooth(span(t, 54.2, 55.0)));
    (net.originRing.material as THREE.MeshBasicMaterial).opacity = smooth(span(t, 54.2, 54.6));
    for (const a of net.arcs) {
      a.m.uniforms.uP.value = smooth(span(t, BASE + a.delay, a.land));
      // the landing ring opens out and fades as the site starts building
      const rk = span(t, a.land - 0.05, a.land + 1.4);
      a.ring.visible = rk > 0 && rk < 1;
      a.ring.scale.setScalar(2 + rk * 16);
      (a.ring.material as THREE.MeshBasicMaterial).opacity = (1 - rk) * 0.9;
      if (a.label) anchor(a.label, a.p.x, 14, a.p.z);
    }
    for (const pt of net.parts) {
      const k = clamp(span(t, pt.t0, pt.t0 + pt.dur));
      pt.o.visible = k > 0.001;
      if (pt.mode === 'grow') pt.o.scale.y = Math.max(0.001, seat(k));
      else if (pt.mode === 'drop') { pt.o.position.y = pt.o.userData.y0 ?? (pt.o.userData.y0 = pt.o.position.y); pt.o.position.y = pt.o.userData.y0 + (1 - seat(k)) * 4; }
      else pt.o.visible = k > 0.5;
    }
  });
  return <primitive object={net.g} />;
}
const clamp = (v: number) => Math.min(1, Math.max(0, v));
