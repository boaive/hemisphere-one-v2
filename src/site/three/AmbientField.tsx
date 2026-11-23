import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Ambient motion behind the "why it hasn't changed" text: a slow field of points rolling like a long swell, read
 * in perspective, with a faint yellow crest. Background only: low contrast, no focal point, no interaction.
 */
const vert = /* glsl */ `
uniform float uTime;
attribute float aSeed;
varying float vH;
varying float vFade;
void main() {
  vec3 p = position;
  float w = sin(p.x * 0.16 + uTime * 0.22) * 0.9 + sin(p.z * 0.23 - uTime * 0.17) * 0.7 + sin((p.x + p.z) * 0.07 + uTime * 0.11) * 1.1;
  p.y += w;
  vH = w;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vFade = smoothstep(-70.0, -18.0, mv.z) * (1.0 - smoothstep(-8.0, -2.0, mv.z));
  gl_PointSize = (1.8 + aSeed * 1.6) * (46.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const frag = /* glsl */ `
varying float vH;
varying float vFade;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.1, d) * vFade;
  vec3 base = vec3(0.62, 0.68, 0.72);
  vec3 crest = vec3(0.99, 0.83, 0.0);
  vec3 col = mix(base, crest, smoothstep(1.6, 2.4, vH) * 0.85);
  gl_FragColor = vec4(col, a * (0.42 + 0.5 * smoothstep(-1.0, 2.2, vH)));
}`;

function Field({ reduced }: { reduced: boolean }) {
  const mat = useRef<THREE.ShaderMaterial>(null!);
  const geo = useMemo(() => {
    const nx = 210, nz = 110, pos: number[] = [], seed: number[] = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { pos.push((i - nx / 2) * 0.55, 0, -j * 0.6); seed.push(Math.random()); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame(({ clock }) => { mat.current.uniforms.uTime.value = reduced ? 8 : clock.elapsedTime; });
  return (
    <points geometry={geo} position={[8, -3.2, 5]}>
      <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} transparent depthWrite={false} uniforms={{ uTime: { value: 0 } }} />
    </points>
  );
}

export default function AmbientField() {
  const host = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { rootMargin: '10% 0px' });
    if (host.current) io.observe(host.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={host} className="ambient" aria-hidden="true">
      <Canvas frameloop={on && !reduced ? 'always' : 'demand'} dpr={[1, 1.5]} camera={{ fov: 42, position: [0, 2.6, 7] }} gl={{ antialias: false, alpha: true }} onCreated={({ camera }) => camera.lookAt(2, -2.5, -16)}>
        <Field reduced={reduced} />
      </Canvas>
    </div>
  );
}
