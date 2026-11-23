import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { concrete, withRepeat } from '../../world/textures';

/**
 * Monolithic material study: one sculpted section of cast wall (window reveal, tie holes, chamfered arrises) in a
 * dark room, read by a single soft light that sweeps slowly across its face, the way a product film reads a
 * material. The form holds still apart from a slow, small turn. Renders only while on screen.
 */
function wallGeometry() {
  const W = 2.6, H = 3.3, R = 0.02;
  const s = new THREE.Shape();
  s.moveTo(-W / 2 + R, -H / 2); s.lineTo(W / 2 - R, -H / 2); s.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + R);
  s.lineTo(W / 2, H / 2 - R); s.quadraticCurveTo(W / 2, H / 2, W / 2 - R, H / 2); s.lineTo(-W / 2 + R, H / 2);
  s.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - R); s.lineTo(-W / 2, -H / 2 + R); s.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + R, -H / 2);
  // window reveal, set off-centre like a real wall panel
  const hole = new THREE.Path();
  const hx0 = -0.55, hx1 = 0.75, hy0 = -0.15, hy1 = 1.05, r = 0.04;
  hole.moveTo(hx0 + r, hy0); hole.lineTo(hx1 - r, hy0); hole.quadraticCurveTo(hx1, hy0, hx1, hy0 + r); hole.lineTo(hx1, hy1 - r); hole.quadraticCurveTo(hx1, hy1, hx1 - r, hy1);
  hole.lineTo(hx0 + r, hy1); hole.quadraticCurveTo(hx0, hy1, hx0, hy1 - r); hole.lineTo(hx0, hy0 + r); hole.quadraticCurveTo(hx0, hy0, hx0 + r, hy0);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 3, curveSegments: 8 });
  g.translate(0, 0, -0.21);
  return g;
}

function Study({ reduced }: { reduced: boolean }) {
  const light = useRef<THREE.SpotLight>(null!);
  const form = useRef<THREE.Group>(null!);
  const { geo, mat, ties } = useMemo(() => {
    const tex = withRepeat(concrete(4, true), 0.42, 0.42);
    const m = new THREE.MeshStandardMaterial({ ...tex, color: '#d9d5ce', roughness: 0.9, normalScale: new THREE.Vector2(0.9, 0.9) });
    // form-tie cones: shallow dark recesses on a 600 mm grid, the signature of a cast wall
    const tie = new THREE.CylinderGeometry(0.03, 0.016, 0.02, 20).rotateX(Math.PI / 2);
    const tm = new THREE.MeshStandardMaterial({ color: '#57534d', roughness: 1 });
    const pts: THREE.Matrix4[] = [];
    for (const x of [-0.95, -0.35, 0.95]) for (const y of [-1.35, -0.75, 1.35]) pts.push(new THREE.Matrix4().makeTranslation(x, y, 0.231));
    for (const x of [-0.95, 0.95]) for (const y of [0.0, 0.6]) pts.push(new THREE.Matrix4().makeTranslation(x, y, 0.231));
    const im = new THREE.InstancedMesh(tie, tm, pts.length); pts.forEach((p, i) => im.setMatrixAt(i, p));
    return { geo: wallGeometry(), mat: m, ties: im };
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // the sweep: a soft key light travels across the face and back (eased, ~14 s round trip)
    const u = reduced ? 0.35 : 0.5 - 0.5 * Math.cos((t / 14) * Math.PI * 2);
    light.current.position.set(-5 + 10 * u, 2.6, 5.2);
    form.current.rotation.y = reduced ? -0.32 : -0.32 + Math.sin(t * 0.16) * 0.06;
  });

  return (
    <>
      <color attach="background" args={['#0b0f12']} />
      <hemisphereLight args={['#cfd9e2', '#0b0f12', 0.16]} />
      <spotLight ref={light} angle={0.78} penumbra={1} intensity={70} distance={18} decay={2} color="#fff4e6" castShadow position={[-3, 2.6, 5.2]} />
      <directionalLight position={[-3, 3, -4]} intensity={0.35} color="#9fb6c8" />
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={0.6} color="#dfe8ef" scale={[6, 1.2, 1]} position={[0, 4, -2]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={0.25} color="#fcd301" scale={[0.6, 4, 1]} position={[5, 0, 1]} rotation-y={-Math.PI / 2} />
      </Environment>
      <group ref={form} position={[0.55, 0.15, 0]} rotation={[0, -0.32, 0]}>
        <mesh geometry={geo} material={mat} castShadow receiveShadow />
        <primitive object={ties} />
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.53, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <shadowMaterial opacity={0.55} />
      </mesh>
    </>
  );
}

export default function MaterialStudy() {
  const host = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: '10% 0px' });
    if (host.current) io.observe(host.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={host} className="study" aria-hidden="true">
      <Canvas frameloop={on ? 'always' : 'never'} shadows dpr={[1, 1.75]} camera={{ fov: 28, position: [0, 0.35, 9.8] }} gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => { gl.toneMapping = THREE.AgXToneMapping; gl.toneMappingExposure = 1.0; }}>
        <Study reduced={reduced} />
      </Canvas>
    </div>
  );
}
