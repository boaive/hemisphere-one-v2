import * as THREE from 'three';
import { mats } from './materials';
import { rbox, merge, place, mesh, rod } from './geo';

/**
 * H1-561 ECO - PROVISIONAL MODEL (validate against OEM drawings). Towable mixer-pump, ~3.8 x 1.9 x 2.5 m.
 * From the corporate deck renders: yellow 80x80 box-section frame around charcoal panels, steel mesh bag-grate over
 * the mixer, skip-loader mast with blue motor housing, single axle with red hubs, A-frame drawbar + jockey wheel,
 * red tow eye, pump outlet flange + delivery hose, control screen on a post. Logo panel left blank (UI decal).
 */
export function buildH1(clipPlanes: THREE.Plane[]) {
  const M = mats();
  const clip = <T extends THREE.Material>(m: T) => { const c = m.clone() as T; (c as THREE.Material).clippingPlanes = clipPlanes; return c; };
  const yellow = clip(M.h1Yellow);
  const charcoal = clip(M.h1Charcoal); (charcoal as THREE.MeshStandardMaterial).color.set('#3d454c');
  const seam = clip(new THREE.MeshStandardMaterial({ color: '#1d2226', roughness: 0.6 }));
  const steel = clip(M.steel), tyre = clip(M.tyre);
  const red = clip(new THREE.MeshStandardMaterial({ color: '#c8312b', roughness: 0.45 }));
  const blue = clip(new THREE.MeshStandardMaterial({ color: '#2c66c4', roughness: 0.4, metalness: 0.2 }));
  const bagM = clip(M.cementBag);
  const g = new THREE.Group();
  const L = 2.9, W = 1.7, H = 1.45, z0 = 0.66;          // body box (x = length, z = width)
  // body: 6 charcoal panels with recessed seams + louvre vents
  const panels: THREE.BufferGeometry[] = [], seams: THREE.BufferGeometry[] = [];
  for (const sz of [-1, 1]) for (let i = 0; i < 3; i++) {
    const pw = L / 3 - 0.03;
    panels.push(place(rbox(pw, H - 0.06, 0.04, 0.012), -L / 2 + L / 6 + i * (L / 3), z0 + H / 2, sz * (W / 2 - 0.02)));
    if (i === 2) for (let k = 0; k < 6; k++) seams.push(place(rbox(pw * 0.6, 0.025, 0.02, 0.004), -L / 2 + L / 6 + i * (L / 3), z0 + 0.35 + k * 0.08, sz * (W / 2 + 0.005)));
  }
  panels.push(place(rbox(0.04, H - 0.06, W - 0.06, 0.012), L / 2 - 0.02, z0 + H / 2, 0));
  panels.push(place(rbox(0.04, H - 0.06, W - 0.06, 0.012), -L / 2 + 0.02, z0 + H / 2, 0));
  panels.push(place(rbox(L - 0.04, 0.04, W - 0.04, 0.012), 0, z0 + H - 0.02, 0));
  seams.push(place(rbox(L - 0.1, H - 0.12, W - 0.1, 0.01), 0, z0 + H / 2, 0));   // dark carcass behind the panel gaps
  g.add(mesh(merge(panels), charcoal), mesh(merge(seams), seam));
  // yellow box-section frame (80 x 80), bevelled
  const f: THREE.BufferGeometry[] = [];
  const s = 0.08;
  for (const sz of [-1, 1]) {
    for (const yy of [z0, z0 + H]) f.push(place(rbox(L + s, s, s, 0.008, 3), 0, yy, sz * (W / 2 + s / 2)));
    for (const xx of [-L / 2, -L / 6, L / 6, L / 2]) f.push(place(rbox(s, H + s, s, 0.008, 3), xx, z0 + H / 2, sz * (W / 2 + s / 2)));
  }
  for (const xx of [-L / 2, L / 2]) for (const yy of [z0, z0 + H]) f.push(place(rbox(s, s, W + 2 * s, 0.008, 3), xx, yy, 0));
  // A-frame drawbar to the tow eye
  f.push(rod(new THREE.Vector3(L / 2, z0, -W / 2), new THREE.Vector3(L / 2 + 1.05, z0 - 0.12, 0), 0.04, 10));
  f.push(rod(new THREE.Vector3(L / 2, z0, W / 2), new THREE.Vector3(L / 2 + 1.05, z0 - 0.12, 0), 0.04, 10));
  // skip-loader mast (ECO): two uprights + top bar at the rear
  for (const sz of [-0.55, 0.55]) f.push(place(rbox(0.09, 2.5, 0.09, 0.008, 3), -L / 2 - 0.12, 1.25, sz));
  f.push(place(rbox(0.09, 0.09, 1.2, 0.008, 3), -L / 2 - 0.12, 2.5, 0));
  g.add(mesh(merge(f), yellow));
  // mixer opening with mesh bag-grate (the shafts turn underneath)
  const grate: THREE.BufferGeometry[] = [place(rbox(1.0, 0.05, 1.2, 0.01), -0.75, z0 + H + 0.03, 0)];
  for (let i = 0; i < 11; i++) grate.push(place(rbox(0.012, 0.03, 1.12, 0.002, 1), -1.2 + i * 0.09, z0 + H + 0.09, 0));
  for (let i = 0; i < 9; i++) grate.push(place(rbox(0.92, 0.03, 0.012, 0.002, 1), -0.75, z0 + H + 0.09, -0.52 + i * 0.13));
  g.add(mesh(merge(grate), steel));
  const mixer = new THREE.Group(); mixer.position.set(-0.75, z0 + H - 0.25, 0);
  mixer.add(mesh(merge([
    place(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 10).rotateZ(Math.PI / 2), 0, 0, -0.22), place(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 10).rotateZ(Math.PI / 2), 0, 0, 0.22),
    ...Array.from({ length: 8 }, (_, i) => place(rbox(0.05, 0.24, 0.13, 0.01), -0.4 + i * 0.115, 0.09, i % 2 ? 0.22 : -0.22, 0.6 * (i % 2 ? 1 : -1), 0, 0)),
  ]), steel));
  g.add(mixer);
  const mix = mesh(new THREE.BoxGeometry(0.92, 0.04, 1.1), clip(M.wetConcrete));
  mix.position.set(-0.75, z0 + H - 0.12, 0); g.add(mix);
  // a premix bag split over the grate (the hero detail)
  const bag = mesh(rbox(0.42, 0.11, 0.62, 0.045), bagM); bag.position.set(-0.6, z0 + H + 0.16, 0.15); bag.rotation.set(0.05, 0.4, 0.08); g.add(bag);
  // skip bucket + blue motor housing on the mast
  const skip = mesh(merge([place(rbox(0.7, 0.45, 0.95, 0.03), 0, 0, 0)]), yellow); skip.position.set(-L / 2 - 0.55, 0.45, 0); g.add(skip);
  const motor = mesh(rbox(0.36, 0.32, 0.4, 0.04), blue); motor.position.set(-L / 2 - 0.12, 2.32, 0.5); g.add(motor);
  // single axle, 15" wheels with red hubs, mudguards
  for (const sz of [-1, 1]) {
    const wz = sz * (W / 2 + 0.24);
    g.add(mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.2, 32).rotateX(Math.PI / 2), tyre).translateX(0.25).translateY(0.33).translateZ(wz));
    g.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.215, 24).rotateX(Math.PI / 2), red).translateX(0.25).translateY(0.33).translateZ(wz));
    g.add(mesh(rbox(0.8, 0.04, 0.3, 0.01), yellow).translateX(0.25).translateY(0.74).translateZ(wz));
  }
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, W + 0.5, 10).rotateX(Math.PI / 2), steel).translateX(0.25).translateY(0.33));
  // jockey wheel + red tow eye
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 10), steel).translateX(L / 2 + 0.85).translateY(0.34));
  g.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 18).rotateX(Math.PI / 2), tyre).translateX(L / 2 + 0.85).translateY(0.09));
  g.add(mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 18).rotateY(Math.PI / 2), red).translateX(L / 2 + 1.12).translateY(z0 - 0.12));
  // pump outlet flange (D100) at the rear, low
  g.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.35, 18).rotateZ(Math.PI / 2), steel).translateX(-L / 2 - 0.1).translateY(z0 + 0.38).translateZ(0.55));
  g.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 18).rotateZ(Math.PI / 2), steel).translateX(-L / 2 - 0.27).translateY(z0 + 0.38).translateZ(0.55));
  // control screen on a post (dosing station)
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), steel).translateX(L / 2 - 0.25).translateY(z0 + H + 0.27).translateZ(W / 2 - 0.2));
  g.add(mesh(rbox(0.34, 0.26, 0.07, 0.02), charcoal).translateX(L / 2 - 0.25).translateY(z0 + H + 0.6).translateZ(W / 2 - 0.2));
  const screen = mesh(new THREE.PlaneGeometry(0.26, 0.17), clip(new THREE.MeshStandardMaterial({ color: '#0c1215', emissive: new THREE.Color('#3FB7E8'), emissiveIntensity: 0.45, roughness: 0.2 })));
  screen.position.set(L / 2 - 0.25, z0 + H + 0.6, W / 2 - 0.16); g.add(screen);
  // blank logo panel (brand applied in the UI layer)
  g.add(mesh(rbox(0.9, 0.42, 0.015, 0.004), clip(new THREE.MeshStandardMaterial({ color: '#f2efe7', roughness: 0.5 }))).translateX(-0.3).translateY(z0 + H * 0.6).translateZ(W / 2 + 0.01));
  return { group: g, mixer, mix };
}
