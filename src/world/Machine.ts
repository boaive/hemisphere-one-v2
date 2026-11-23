import * as THREE from 'three';
import { mats } from './materials';
import { rbox, merge, place, mesh, rod } from './geo';

/**
 * H1-561 MINI - semi-automatic portable concrete mixer and pump, modelled from the client's CAD view
 * (hemisphere-one.com / V1 product image). Published size, collapsed: 2.0 x 1.1 x 1.6 m.
 * Yellow box-section chassis with charcoal infill panels, front housing with two access hatches, U-shaped
 * mixer trough with a bag-breaker grate, rear control cabinet, fold-out working platform with tubular
 * railing, single axle with red hubs, A-frame drawbar with jockey wheel, pump outlet flange.
 * x = length (drawbar at +x), z = width, y = up. Origin at ground level, centred.
 */
export function buildH1(clipPlanes: THREE.Plane[] = []) {
  const M = mats();
  const clip = <T extends THREE.Material>(m: T) => { const c = m.clone() as T; if (clipPlanes.length) (c as THREE.Material).clippingPlanes = clipPlanes; return c; };
  const yellow = clip(new THREE.MeshStandardMaterial({ color: '#f4be12', roughness: 0.38, metalness: 0.15 }));
  const charcoal = clip(new THREE.MeshStandardMaterial({ color: '#2c3136', roughness: 0.5, metalness: 0.3 }));
  const dark = clip(new THREE.MeshStandardMaterial({ color: '#16191c', roughness: 0.55, metalness: 0.2 }));
  const steel = clip(new THREE.MeshStandardMaterial({ color: '#b9bfc4', roughness: 0.3, metalness: 1 }));
  const rail = clip(new THREE.MeshStandardMaterial({ color: '#3a3f44', roughness: 0.4, metalness: 0.6 }));
  const tyre = clip(new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.88 }));
  const red = clip(new THREE.MeshStandardMaterial({ color: '#c62f2a', roughness: 0.4, metalness: 0.2 }));
  const blue = clip(new THREE.MeshStandardMaterial({ color: '#2357b8', roughness: 0.4, metalness: 0.25 }));
  void M;

  const g = new THREE.Group();
  const L = 2.0, W = 1.1, B = 0.4, D = 0.96, TOP = 1.6;     // length, width, chassis bottom, deck, overall height
  const s = 0.06;                                           // box-section size
  const F: THREE.BufferGeometry[] = [];
  // chassis: bottom + deck rails, corner + intermediate uprights
  for (const z of [-W / 2 + s / 2, W / 2 - s / 2]) for (const y of [B, D]) F.push(place(rbox(L, s, s, 0.006, 2), 0, y, z));
  for (const x of [-L / 2 + s / 2, L / 2 - s / 2]) for (const y of [B, D]) F.push(place(rbox(s, s, W, 0.006, 2), x, y, 0));
  for (const x of [-L / 2 + s / 2, -0.32, 0.3, L / 2 - s / 2]) for (const z of [-W / 2 + s / 2, W / 2 - s / 2]) F.push(place(rbox(s, D - B, s, 0.006, 2), x, (B + D) / 2, z));
  // front housing (two hatches on top) and its frame
  F.push(place(rbox(0.62, TOP - D - 0.02, W - 0.02, 0.02, 3), L / 2 - 0.31, (D + TOP) / 2, 0));
  // rear control cabinet
  F.push(place(rbox(0.42, TOP - D - 0.12, W - 0.02, 0.02, 3), -L / 2 + 0.21, (D + TOP - 0.1) / 2, 0));
  // drawbar A-frame to the tow eye
  F.push(rod(new THREE.Vector3(L / 2, B + 0.05, -0.36), new THREE.Vector3(L / 2 + 0.62, B - 0.02, 0), 0.028, 10));
  F.push(rod(new THREE.Vector3(L / 2, B + 0.05, 0.36), new THREE.Vector3(L / 2 + 0.62, B - 0.02, 0), 0.028, 10));
  g.add(mesh(merge(F), yellow));

  // infill panels (lower body) + deck plate + cabinet doors + hatch lids
  const P: THREE.BufferGeometry[] = [];
  for (const z of [-W / 2 + 0.012, W / 2 - 0.012]) {
    P.push(place(rbox(0.6, D - B - 0.08, 0.02, 0.006, 2), -0.66, (B + D) / 2, z));
    P.push(place(rbox(0.56, D - B - 0.08, 0.02, 0.006, 2), -0.01, (B + D) / 2, z));
    P.push(place(rbox(0.6, D - B - 0.08, 0.02, 0.006, 2), 0.65, (B + D) / 2, z));
  }
  P.push(place(rbox(0.02, D - B - 0.08, W - 0.12, 0.006, 2), L / 2 - 0.012, (B + D) / 2, 0));
  P.push(place(rbox(0.02, D - B - 0.08, W - 0.12, 0.006, 2), -L / 2 + 0.012, (B + D) / 2, 0));
  P.push(place(rbox(L - 0.1, 0.03, W - 0.1, 0.006, 2), 0, D + 0.03, 0));
  P.push(place(rbox(0.3, 0.035, 0.36, 0.008, 2), L / 2 - 0.42, TOP + 0.005, -0.24), place(rbox(0.3, 0.035, 0.36, 0.008, 2), L / 2 - 0.42, TOP + 0.005, 0.24));
  P.push(place(rbox(0.4, 0.03, W - 0.1, 0.006, 2), -L / 2 + 0.21, TOP - 0.09, 0));
  for (const z of [-0.2, 0.2]) P.push(place(rbox(0.02, 0.46, 0.34, 0.006, 2), -L / 2 - 0.002, (D + TOP - 0.1) / 2, z));
  g.add(mesh(merge(P), charcoal));
  // hatch handles + cabinet louvres
  const H: THREE.BufferGeometry[] = [];
  for (const z of [-0.24, 0.24]) H.push(place(rbox(0.1, 0.02, 0.03, 0.004, 1), L / 2 - 0.42, TOP + 0.03, z));
  for (let k = 0; k < 6; k++) H.push(place(rbox(0.012, 0.014, W - 0.3, 0.003, 1), -L / 2 + 0.06 + k * 0.05, TOP - 0.06, 0));
  g.add(mesh(merge(H), dark));

  // U-shaped mixer trough with flared hopper rim (bag-breaker grate on top)
  const tw = 0.82, tr = 0.3, th = 0.52;     // trough width (x), bottom radius, wall height
  const shape = new THREE.Shape();
  shape.moveTo(-tw / 2, th);
  shape.lineTo(-tw / 2, tr);
  shape.absarc(0, tr, tw / 2, Math.PI, 2 * Math.PI, false);
  shape.lineTo(tw / 2, th);
  shape.lineTo(tw / 2 - 0.03, th);
  shape.lineTo(tw / 2 - 0.03, tr);
  shape.absarc(0, tr, tw / 2 - 0.03, 2 * Math.PI, Math.PI, true);
  shape.lineTo(-tw / 2 + 0.03, th);
  shape.closePath();
  const trough = new THREE.ExtrudeGeometry(shape, { depth: W - 0.24, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 28 });
  trough.translate(0, 0, -(W - 0.24) / 2);
  const troughMesh = mesh(trough, yellow); troughMesh.position.set(0.02, D + 0.05, 0); g.add(troughMesh);
  // end plates of the trough (filled U)
  const endShape = new THREE.Shape();
  endShape.moveTo(-tw / 2, th); endShape.lineTo(-tw / 2, tr);
  endShape.absarc(0, tr, tw / 2, Math.PI, 2 * Math.PI, false);
  endShape.lineTo(tw / 2, th); endShape.closePath();
  const plate = new THREE.ExtrudeGeometry(endShape, { depth: 0.02, bevelEnabled: false, curveSegments: 28 });
  const plates = merge([plate.clone().translate(0, 0, (W - 0.24) / 2 - 0.01), plate.clone().translate(0, 0, -(W - 0.24) / 2 - 0.01)]);
  const plateMesh = mesh(plates, yellow); plateMesh.position.copy(troughMesh.position); g.add(plateMesh);
  // flared hopper rim
  const rim = merge([
    place(rbox(tw + 0.16, 0.04, 0.04, 0.006, 2), 0, 0, (W - 0.2) / 2), place(rbox(tw + 0.16, 0.04, 0.04, 0.006, 2), 0, 0, -(W - 0.2) / 2),
    place(rbox(0.04, 0.04, W - 0.2, 0.006, 2), (tw + 0.12) / 2, 0, 0), place(rbox(0.04, 0.04, W - 0.2, 0.006, 2), -(tw + 0.12) / 2, 0, 0),
  ]);
  const rimMesh = mesh(rim, dark); rimMesh.position.set(0.02, D + 0.05 + th + 0.06, 0); g.add(rimMesh);
  // bag-breaker grate (steel mesh with a carry handle)
  const G: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) G.push(place(rbox(0.012, 0.016, W - 0.26, 0.003, 1), -tw / 2 + 0.05 + i * ((tw - 0.1) / 11), 0, 0));
  for (let i = 0; i < 12; i++) G.push(place(rbox(tw - 0.06, 0.012, 0.01, 0.003, 1), 0, 0.012, -(W - 0.3) / 2 + i * ((W - 0.3) / 11)));
  G.push(rod(new THREE.Vector3(-0.12, 0.02, 0), new THREE.Vector3(-0.12, 0.1, 0), 0.008, 6), rod(new THREE.Vector3(0.12, 0.02, 0), new THREE.Vector3(0.12, 0.1, 0), 0.008, 6), rod(new THREE.Vector3(-0.12, 0.1, 0), new THREE.Vector3(0.12, 0.1, 0), 0.008, 6));
  const grate = mesh(merge(G), steel); grate.position.set(0.02, D + 0.05 + th + 0.09, 0); g.add(grate);
  // the mix (visible through the grate) + mixing shafts
  const mix = mesh(new THREE.BoxGeometry(tw - 0.08, 0.03, W - 0.3), clip(M.wetConcrete)); mix.position.set(0.02, D + 0.05 + th - 0.08, 0); g.add(mix);
  const mixer = new THREE.Group(); mixer.position.set(0.02, D + 0.05 + tr + 0.02, 0);
  mixer.add(mesh(merge([
    new THREE.CylinderGeometry(0.03, 0.03, W - 0.28, 10).rotateX(Math.PI / 2),
    ...Array.from({ length: 6 }, (_, i) => place(rbox(0.05, 0.22, 0.09, 0.008, 1), 0, 0.1, -0.36 + i * 0.145, 0, 0, 0)),
  ]), steel));
  mixer.rotation.z = 0; g.add(mixer);
  // drive motor (blue) under the trough, sight glass on the trough end
  const motor = mesh(rbox(0.22, 0.18, 0.26, 0.03, 2), blue); motor.position.set(0.46, D + 0.16, -0.32); g.add(motor);
  const sight = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 20).rotateX(Math.PI / 2), steel); sight.position.set(0.02, D + 0.05 + tr, (W - 0.24) / 2 + 0.02); g.add(sight);

  // pump outlet flange on the front panel
  const outlet = new THREE.Vector3(L / 2 + 0.05, B + 0.28, 0.24);
  const fl = mesh(merge([new THREE.CylinderGeometry(0.06, 0.06, 0.1, 20).rotateZ(Math.PI / 2), place(new THREE.CylinderGeometry(0.095, 0.095, 0.025, 20).rotateZ(Math.PI / 2), 0.05, 0, 0)]), steel);
  fl.position.copy(outlet); g.add(fl);

  // fold-out working platform at the rear, with tubular railing and legs with levelling feet
  const pz = 0, pl = 0.7, pw = W - 0.1, py = D - 0.02;
  const deck = mesh(rbox(pl, 0.03, pw, 0.006, 2), charcoal); deck.position.set(-L / 2 - pl / 2, py, pz); g.add(deck);
  const R: THREE.BufferGeometry[] = [];
  const x0 = -L / 2 - pl + 0.03, x1 = -L / 2 - 0.02;
  for (const z of [-pw / 2 + 0.03, pw / 2 - 0.03]) {
    R.push(rod(new THREE.Vector3(x0, 0.03, z), new THREE.Vector3(x0, py, z), 0.02, 8));                         // legs
    R.push(rod(new THREE.Vector3(x0, py, z), new THREE.Vector3(x0, py + 0.95, z), 0.014, 8));                   // posts
    R.push(rod(new THREE.Vector3(x1, py, z), new THREE.Vector3(x1 - 0.02, py + 0.95, z), 0.014, 8));
    R.push(rod(new THREE.Vector3(x0, py + 0.95, z), new THREE.Vector3(x1 - 0.02, py + 0.95, z), 0.014, 8));     // top rail
    R.push(rod(new THREE.Vector3(x0, py + 0.5, z), new THREE.Vector3(x1, py + 0.5, z), 0.012, 8));              // knee rail
    R.push(place(new THREE.CylinderGeometry(0.04, 0.05, 0.03, 12), x0, 0.015, z));                              // levelling feet
  }
  R.push(rod(new THREE.Vector3(x0, py + 0.95, -pw / 2 + 0.03), new THREE.Vector3(x0, py + 0.95, pw / 2 - 0.03), 0.014, 8));
  g.add(mesh(merge(R), rail));

  // single axle, wheels with red hubs, mudguards
  for (const sz of [-1, 1]) {
    const wz = sz * (W / 2 + 0.11);
    const tyreM = mesh(new THREE.TorusGeometry(0.21, 0.085, 14, 32), tyre);   // ring in XY: rolls along x, axle along z
    tyreM.position.set(0, 0.3, wz); g.add(tyreM);
    const rimM = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.13, 28).rotateX(Math.PI / 2), red); rimM.position.set(0, 0.3, wz); g.add(rimM);
    const hub = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 16).rotateX(Math.PI / 2), steel); hub.position.set(0, 0.3, wz); g.add(hub);
  }
  const axle = mesh(new THREE.CylinderGeometry(0.03, 0.03, W + 0.2, 10).rotateX(Math.PI / 2), dark); axle.position.set(0, 0.3, 0); g.add(axle);
  // jockey wheel + tow eye
  const jw = new THREE.Group(); jw.position.set(L / 2 + 0.42, 0, 0);
  jw.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 10).translate(0, 0.27, 0), steel));
  const jt = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 18).rotateX(Math.PI / 2), tyre); jt.position.y = 0.08; jw.add(jt);
  const jh = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.065, 16).rotateX(Math.PI / 2), red); jh.position.y = 0.08; jw.add(jh);
  g.add(jw);
  const eye = mesh(new THREE.TorusGeometry(0.045, 0.014, 8, 18).rotateY(Math.PI / 2), red); eye.position.set(L / 2 + 0.66, B - 0.02, 0); g.add(eye);

  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return { group: g, mixer, mix, outlet };
}
