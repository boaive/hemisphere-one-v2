import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * A kinetic wall of thin tiles: graphite on the face, brand yellow on the back. Tiles near the pointer turn over
 * and settle back on springs, leaving a short yellow trail; without a pointer a slow ripple keeps the wall alive.
 * Decorative only.
 */
const NX = 34, NY = 20, GAP = 0.92;

function Wall({ reduced }: { reduced: boolean }) {
  const face = useRef<THREE.InstancedMesh>(null!);
  const back = useRef<THREE.InstancedMesh>(null!);
  const { camera, pointer } = useThree();
  const st = useMemo(() => ({
    ang: new Float32Array(NX * NY), vel: new Float32Array(NX * NY),
    m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1),
    ray: new THREE.Raycaster(), plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit: new THREE.Vector3(),
  }), []);
  const geo = useMemo(() => ({ face: new RoundedBoxGeometry(0.84, 0.84, 0.05, 3, 0.03).translate(0, 0, 0.026), back: new RoundedBoxGeometry(0.84, 0.84, 0.05, 3, 0.03).translate(0, 0, -0.026) }), []);
  useEffect(() => () => { geo.face.dispose(); geo.back.dispose(); }, [geo]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime, h = Math.min(dt, 0.05);
    st.ray.setFromCamera(pointer, camera);
    const has = !reduced && !!st.ray.ray.intersectPlane(st.plane, st.hit) && Math.abs(pointer.x) < 1 && Math.abs(pointer.y) < 1;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      const x = (i - (NX - 1) / 2) * GAP, y = (j - (NY - 1) / 2) * GAP;
      // target angle: a slow diagonal ripple, plus a full turn near the pointer
      let target = reduced ? 0.25 : 0.22 * Math.sin(t * 0.6 - (x * 0.35 + y * 0.25));
      if (has) { const d = Math.hypot(x + 6 - st.hit.x, y - st.hit.y); target += Math.PI * (1 - THREE.MathUtils.smoothstep(d, 0.8, 3.4)); }
      st.vel[k] += ((target - st.ang[k]) * 26 - st.vel[k] * 7.5) * h;
      st.ang[k] += st.vel[k] * h;
      st.p.set(x, y, 0);
      st.q.setFromEuler(st.e.set(0, st.ang[k], 0));
      st.m.compose(st.p, st.q, st.s);
      face.current.setMatrixAt(k, st.m); back.current.setMatrixAt(k, st.m);
    }
    face.current.instanceMatrix.needsUpdate = true; back.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group rotation={[0, -0.38, 0]} position={[6, 0, 0]}>
      <instancedMesh ref={face} args={[geo.face, undefined, NX * NY]}>
        <meshStandardMaterial color="#1f262c" metalness={0.55} roughness={0.32} />
      </instancedMesh>
      <instancedMesh ref={back} args={[geo.back, undefined, NX * NY]}>
        <meshStandardMaterial color="#fcd301" metalness={0.1} roughness={0.35} />
      </instancedMesh>
    </group>
  );
}

export default function KineticTiles({ source }: { source?: React.RefObject<HTMLElement> }) {
  const host = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: '10% 0px' });
    if (host.current) io.observe(host.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={host} className="tiles" aria-hidden="true">
      <Canvas frameloop={on ? 'always' : 'never'} dpr={[1, 1.5]} camera={{ fov: 34, position: [0, 0, 26] }} gl={{ antialias: true, alpha: true }}
        eventSource={(source as React.MutableRefObject<HTMLElement>) ?? undefined} eventPrefix="client"
        onCreated={({ gl }) => { gl.toneMapping = THREE.AgXToneMapping; }}>
        <ambientLight intensity={0.25} />
        <directionalLight position={[-6, 5, 8]} intensity={1.8} color="#fff4e2" />
        <Environment resolution={128}>
          <Lightformer form="rect" intensity={1.6} color="#ffffff" scale={[12, 2, 1]} position={[0, 6, 6]} rotation-x={-Math.PI / 3} />
          <Lightformer form="rect" intensity={0.6} color="#9fb6c8" scale={[2, 10, 1]} position={[-9, 0, 3]} rotation-y={Math.PI / 2} />
        </Environment>
        <Wall reduced={reduced} />
      </Canvas>
    </div>
  );
}
