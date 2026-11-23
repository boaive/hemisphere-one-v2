import { forwardRef, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, N8AO, Bloom, ToneMapping } from '@react-three/postprocessing';
import { Effect, BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { film } from '../film/clock';
import { LOOKS } from '../film/looks';
import { camState } from '../film/CameraRig';

/**
 * Film grade (display space, after AgX): exposure, white balance, black lift, contrast, saturation, gentle vignette.
 * No grain in offline renders (it would be averaged away by accumulation and wastes video bitrate).
 */
const frag = /* glsl */ `
uniform float uExposure; uniform float uWarm; uniform float uTint; uniform float uContrast; uniform float uSat;
uniform float uVignette; uniform float uLift; uniform float uAspect;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb * uExposure;
  c *= vec3(1.0 + uWarm * 0.9, 1.0 + uWarm * 0.15 + uTint, 1.0 - uWarm * 0.9);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c = (c - 0.5) * uContrast + 0.5;
  c = max(c, 0.0); c = c / (1.0 + 0.04 * c);
  c = uLift + c * (1.0 - uLift);
  vec2 q = uv - 0.5; q.x *= uAspect * 0.62;
  c *= 1.0 - uVignette * smoothstep(0.3, 0.95, length(q));
  outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
}`;

class FilmGradeEffect extends Effect {
  constructor() {
    super('FilmGrade', frag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['uExposure', new THREE.Uniform(1)], ['uWarm', new THREE.Uniform(0)], ['uTint', new THREE.Uniform(0)],
        ['uContrast', new THREE.Uniform(1)], ['uSat', new THREE.Uniform(1)], ['uVignette', new THREE.Uniform(0.12)],
        ['uLift', new THREE.Uniform(0)], ['uAspect', new THREE.Uniform(16 / 9)],
      ]),
    });
  }
}
const FilmGrade = forwardRef<FilmGradeEffect>(function FilmGrade(_, ref) {
  const effect = useMemo(() => new FilmGradeEffect(), []);
  return <primitive ref={ref} object={effect} dispose={null} />;
});

export function Post({ draft = false }: { draft?: boolean }) {
  const grade = useRef<FilmGradeEffect>(null!);
  const ao = useRef<any>(null);
  useFrame((state) => {
    const g = grade.current; if (!g) return;
    const G = LOOKS[film.scene].grade;
    const u = (k: string) => g.uniforms.get(k)!;
    u('uExposure').value = G.exposure; u('uWarm').value = G.warm; u('uTint').value = G.tint;
    u('uContrast').value = G.contrast; u('uSat').value = G.sat; u('uVignette').value = G.vignette; u('uLift').value = G.lift;
    u('uAspect').value = state.size.width / state.size.height;
    // ambient occlusion radius follows the scale of the shot (city metres vs human metres)
    const a = ao.current;
    if (a?.configuration) {
      const s = camState.scale;
      a.configuration.aoRadius = s === 'city' ? 5 : s === 'site' ? 1.4 : 0.6;
      a.configuration.distanceFalloff = s === 'city' ? 1.6 : s === 'site' ? 0.5 : 0.25;
      a.configuration.intensity = s === 'city' ? 2.4 : 2.2;
    }
  });
  return (
    <EffectComposer multisampling={0} enableNormalPass={false} frameBufferType={THREE.HalfFloatType}>
      <N8AO ref={ao} halfRes={draft} aoRadius={5} distanceFalloff={1.6} intensity={2.4} quality={draft ? 'performance' : 'high'} />
      <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.15} intensity={0.22} radius={0.55} />
      <ToneMapping mode={LOOKS[film.scene].tone === 'neutral' ? ToneMappingMode.NEUTRAL : ToneMappingMode.AGX} />
      <FilmGrade ref={grade} />
    </EffectComposer>
  );
}
