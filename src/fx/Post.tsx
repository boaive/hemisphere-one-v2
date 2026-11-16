import { forwardRef, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, N8AO, Bloom, ToneMapping } from '@react-three/postprocessing';
import { Effect, BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { film, span, smooth, lerp } from '../film/clock';

/**
 * Film grade (display space, after AgX): exposure, white balance, contrast, saturation, gentle vignette, fine grain.
 * Scene 1 cool-neutral, Scene 2 warm-natural, Scene 3 natural with clarity, final balanced. No lens flares, no heavy bloom.
 */
const frag = /* glsl */ `
uniform float uExposure; uniform float uWarm; uniform float uTint; uniform float uContrast; uniform float uSat;
uniform float uVignette; uniform float uGrain; uniform float uSeed;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uSeed) * 43758.5453); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb * uExposure;
  c *= vec3(1.0 + uWarm * 0.9, 1.0 + uWarm * 0.15 + uTint, 1.0 - uWarm * 0.9);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c = (c - 0.5) * uContrast + 0.5;
  // soft filmic toe so contrast never crushes to pure black
  c = max(c, 0.0); c = c / (1.0 + 0.04 * c);
  vec2 q = uv - 0.5; q.x *= 1.15;
  c *= 1.0 - uVignette * smoothstep(0.35, 0.95, length(q));
  float g = h(uv * 1024.0) - 0.5;
  float lum = dot(c, vec3(0.333));
  c += g * uGrain * (0.35 + 0.65 * 4.0 * lum * (1.0 - lum));
  outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
}`;

class FilmGradeEffect extends Effect {
  constructor() {
    super('FilmGrade', frag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['uExposure', new THREE.Uniform(1)], ['uWarm', new THREE.Uniform(0)], ['uTint', new THREE.Uniform(0)],
        ['uContrast', new THREE.Uniform(1.04)], ['uSat', new THREE.Uniform(1)], ['uVignette', new THREE.Uniform(0.14)],
        ['uGrain', new THREE.Uniform(0.014)], ['uSeed', new THREE.Uniform(0)],
      ]),
    });
  }
}
const FilmGrade = forwardRef<FilmGradeEffect>(function FilmGrade(_, ref) {
  const effect = useMemo(() => new FilmGradeEffect(), []);
  return <primitive ref={ref} object={effect} dispose={null} />;
});

export function Post({ mobile, quality }: { mobile: boolean; quality: number }) {
  const grade = useRef<FilmGradeEffect>(null!);
  const ao = useRef<any>(null);
  useFrame((state) => {
    const t = film.t;
    const g = grade.current; if (!g) return;
    const u = (k: string) => g.uniforms.get(k)!;
    const warm = smooth(span(t, 19.5, 23)) * (1 - 0.45 * smooth(span(t, 37.5, 41.5)));
    const final = smooth(span(t, 55, 58));
    u('uWarm').value = lerp(-0.035, 0.075, warm) * (1 - final * 0.6);
    u('uTint').value = lerp(0.0, 0.006, warm);
    u('uExposure').value = lerp(1.0, 1.04, warm);
    u('uContrast').value = lerp(1.06, 1.02, warm) + 0.03 * smooth(span(t, 38, 42));
    u('uSat').value = lerp(0.95, 1.05, warm);
    u('uVignette').value = lerp(0.12, 0.16, warm);
    u('uSeed').value = (state.clock.elapsedTime * 60) % 1000;
    // ambient occlusion radius follows scene scale (city metres vs human metres)
    const a = ao.current;
    if (a?.configuration) {
      const city = t < 21.5 || t > 55.5;
      a.configuration.aoRadius = city ? 6 : 0.9;
      a.configuration.distanceFalloff = city ? 2.0 : 0.35;
      a.configuration.intensity = city ? 2.2 : 2.6;
    }
  });
  return (
    <EffectComposer multisampling={mobile ? 0 : 4} enableNormalPass={false}>
      {quality > 0 ? <N8AO ref={ao} halfRes aoRadius={6} distanceFalloff={2} intensity={2.2} quality={mobile ? 'performance' : 'medium'} /> : <></>}
      <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.1} intensity={0.32} radius={0.6} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <FilmGrade ref={grade} />
    </EffectComposer>
  );
}
