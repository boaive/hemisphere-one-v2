import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Abstract, playful 3D for a light page: a loose cluster of glossy forms (ceramic white, graphite and one brand
 * yellow) floating in the air. They breathe slowly, lean toward the pointer and slip out of its way on springs,
 * then settle back. Purely decorative: no meaning, no text, nothing to learn.
 */
type Body = { home: THREE.Vector3; p: THREE.Vector3; v: THREE.Vector3; rot: THREE.Euler; spin: THREE.Vector3; mesh?: THREE.Mesh; ph: number; s: number };

function useShapes() {
  return useMemo(() => {
    const geos = [
      new THREE.SphereGeometry(0.62, 64, 48),
      new RoundedBoxGeometry(1.0, 1.0, 1.0, 6, 0.22),
      new THREE.TorusGeometry(0.52, 0.2, 40, 96),
      new THREE.CapsuleGeometry(0.32, 0.8, 16, 40),
      new THREE.CylinderGeometry(0.5, 0.5, 0.34, 64),
      new THREE.IcosahedronGeometry(0.6, 0),
    ];
    const ceramic = new THREE.MeshPhysicalMaterial({ color: '#f4f2ee', roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12 });
    const graphite = new THREE.MeshPhysicalMaterial({ color: '#2b3137', roughness: 0.4, metalness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.2 });
    const yellow = new THREE.MeshPhysicalMaterial({ color: '#fcd301', roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
    const glass = new THREE.MeshPhysicalMaterial({ color: '#dfe7ec', roughness: 0.08, transmission: 0.92, thickness: 0.8, ior: 1.4, clearcoat: 1 });
    // hand-placed so the cluster reads as composed, not scattered
    const layout: [number, number, number, number, THREE.Material, number][] = [
      [0, 0.15, 0.0, 0, yellow, 1.15],
      [-1.55, 0.85, -0.6, 1, ceramic, 0.92],
      [1.6, 1.05, -0.3, 2, graphite, 1.0],
      [1.25, -0.95, 0.4, 3, ceramic, 1.0],
      [-1.3, -1.0, 0.5, 4, graphite, 1.05],
      [-0.25, 1.75, -1.2, 5, ceramic, 0.7],
      [0.45, -1.85, -0.9, 0, glass, 0.7],
      [2.65, -0.05, -1.3, 0, ceramic, 0.55],
      [-2.7, 0.15, -1.1, 1, yellow, 0.45],
    ];
    const bodies: Body[] = layout.map(([x, y, z, gi, , s], i) => ({
      home: new THREE.Vector3(x, y, z), p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(), rot: new THREE.Euler(i * 0.7, i * 1.3, i * 0.4),
      spin: new THREE.Vector3(0.05 + (i % 3) * 0.03, 0.08 + (i % 2) * 0.05, 0.03), ph: i * 1.7, s, mesh: undefined,
    }));
    return { geos, layout, bodies };
  }, []);
}

function Cluster({ reduced }: { reduced: boolean }) {
  const { geos, layout, bodies } = useShapes();
  const group = useRef<THREE.Group>(null!);
  const { camera, pointer } = useThree();
  const tmp = useMemo(() => ({ ray: new THREE.Raycaster(), plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit: new THREE.Vector3(), d: new THREE.Vector3(), active: false }), []);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime, h = Math.min(dt, 0.05);
    tmp.ray.setFromCamera(pointer, camera);
    tmp.active = !!tmp.ray.ray.intersectPlane(tmp.plane, tmp.hit) && Math.abs(pointer.x) < 1 && Math.abs(pointer.y) < 1;
    for (const b of bodies) {
      // breathing drift around home, a spring back to it, and a soft push away from the pointer
      const target = tmp.d.copy(b.home).add(new THREE.Vector3(Math.sin(t * 0.4 + b.ph) * 0.12, Math.sin(t * 0.55 + b.ph * 1.3) * 0.16, 0));
      const f = target.sub(b.p).multiplyScalar(9);
      if (tmp.active && !reduced) {
        const away = b.p.clone().sub(tmp.hit); away.z *= 0.4;
        const dist = away.length(), r = 1.35 + b.s * 0.5;
        if (dist < r) f.add(away.normalize().multiplyScalar(((r - dist) / r) * 38));
      }
      b.v.addScaledVector(f, h).multiplyScalar(Math.exp(-h * 4.2));
      if (!reduced) b.p.addScaledVector(b.v, h);
      b.rot.x += b.spin.x * h * (1 + b.v.length() * 0.6); b.rot.y += b.spin.y * h * (1 + b.v.length() * 0.6);
      if (b.mesh) { b.mesh.position.copy(b.p); b.mesh.rotation.copy(b.rot); }
    }
    // the whole cluster leans gently toward the pointer
    const tx = reduced ? 0 : pointer.y * -0.12, ty = reduced ? 0 : pointer.x * 0.22;
    group.current.rotation.x += (tx - group.current.rotation.x) * Math.min(1, h * 2.5);
    group.current.rotation.y += (ty - group.current.rotation.y) * Math.min(1, h * 2.5);
  });

  return (
    <group ref={group}>
      {layout.map(([, , , gi, m, s], i) => (
        <mesh key={i} ref={(n) => { if (n) bodies[i].mesh = n; }} geometry={geos[gi]} material={m} scale={s} castShadow />
      ))}
    </group>
  );
}

export default function Playground({ source }: { source?: React.RefObject<HTMLElement> }) {
  const host = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: '10% 0px' });
    if (host.current) io.observe(host.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={host} className="play" aria-hidden="true">
      <Canvas frameloop={on ? 'always' : 'never'} dpr={[1, 1.75]} camera={{ fov: 30, position: [0, 0, 11] }} gl={{ antialias: true, alpha: true }}
        eventSource={(source as React.MutableRefObject<HTMLElement>) ?? undefined} eventPrefix="client"
        onCreated={({ gl }) => { gl.toneMapping = THREE.AgXToneMapping; gl.toneMappingExposure = 1.05; }}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[4, 6, 5]} intensity={1.6} color="#fff8ee" />
        <Environment resolution={256}>
          <Lightformer form="rect" intensity={2.2} color="#ffffff" scale={[10, 3, 1]} position={[0, 6, 4]} rotation-x={-Math.PI / 3} />
          <Lightformer form="rect" intensity={1.2} color="#fff3d6" scale={[3, 8, 1]} position={[-7, 0, 2]} rotation-y={Math.PI / 2} />
          <Lightformer form="rect" intensity={0.8} color="#dfe8f0" scale={[3, 8, 1]} position={[7, 0, 2]} rotation-y={-Math.PI / 2} />
        </Environment>
        <Cluster reduced={reduced} />
        <ContactShadows position={[0, -2.9, 0]} scale={14} blur={2.6} far={6} opacity={0.32} frames={reduced ? 1 : Infinity} />
      </Canvas>
    </div>
  );
}
