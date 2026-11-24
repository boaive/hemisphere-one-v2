import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { machine, formwork, rtarium, premix, admix } from './models';
import type { Product } from '../content';

/** soft contact shadow as a static radial texture (cheap enough for many views) */
let blobTex: THREE.Texture | null = null;
function blob() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.55, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

const MAKE: Record<Product['id'], () => THREE.Object3D | Promise<THREE.Object3D>> = { h1: machine, formwork, rtarium, premix, admix };

/**
 * One product, lit like a product shot: key from upper right, cool rim, soft reflections, a contact shadow.
 * The object turns slowly back and forth (never spins), so its form reads without demanding attention.
 */
export function ProductScene({ id, phase = 0, reduced = false }: { id: Product['id']; phase?: number; reduced?: boolean }) {
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  const g = useRef<THREE.Group>(null!);
  useEffect(() => {
    let alive = true;
    Promise.resolve(MAKE[id]()).then((o) => { if (alive) setObj(o); }).catch(() => {});
    return () => { alive = false; };
  }, [id]);
  const shadow = useMemo(() => blob(), []);
  useFrame(({ clock }) => { if (g.current) g.current.rotation.y = reduced ? 0 : Math.sin(clock.elapsedTime * 0.22 + phase) * 0.32; });
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 1.5, 6.4]} fov={25} onUpdate={(c) => c.lookAt(0, 0.95, 0)} />
      <hemisphereLight args={['#ffffff', '#d9d4cc', 1.0]} />
      <directionalLight position={[3.5, 5, 4]} intensity={2.2} color="#fff6ea" />
      <directionalLight position={[-4, 2.5, 2]} intensity={0.8} color="#e6eef5" />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={1.4} color="#ffffff" scale={[5, 2, 1]} position={[0, 4, 3]} rotation-x={-Math.PI / 3} />
        <Lightformer form="rect" intensity={0.5} color="#9fb6c8" scale={[2, 5, 1]} position={[-5, 1, -1]} rotation-y={Math.PI / 2} />
      </Environment>
      <group ref={g}>{obj && <primitive object={obj} />}</group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.003}>
        <planeGeometry args={[3.6, 3.6]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} />
      </mesh>
    </>
  );
}
