import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { film, span, smooth, lerp } from '../film/clock';
import { track } from '../ui/loading';

/**
 * One sun for the whole film (direction never changes). Cool-neutral district -> warm everyday site is carried by
 * atmosphere + exposure + grade, not by moving the sun. Real HDRI for reflections, photographic sky as background.
 */
export const SUN_DIR = new THREE.Vector3(-0.78, 0.58, -0.22).normalize();

export function Atmosphere({ mobile }: { mobile: boolean }) {
  const { scene, gl, camera } = useThree();

  const sun = useMemo(() => {
    const l = new THREE.DirectionalLight('#fff4e6', 3.4);
    l.castShadow = true;
    l.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    l.shadow.bias = -0.00025; l.shadow.normalBias = 0.035;
    l.shadow.camera.near = 1; l.shadow.camera.far = 900;
    return l;
  }, [mobile]);
  const fill = useMemo(() => new THREE.HemisphereLight('#cfe0f2', '#8a7660', 0.35), []);

  useEffect(() => {
    const doneSky = track('sky'), doneHdr = track('hdri');
    new THREE.TextureLoader().load(mobile ? '/hdri/sky_bg_2k.jpg' : '/hdri/sky_bg_4k.jpg', (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
      scene.background = tex; scene.backgroundIntensity = 1.0; doneSky();
    }, undefined, doneSky);
    new RGBELoader().load('/hdri/sky_1k.hdr', (hdr) => {
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      const pm = new THREE.PMREMGenerator(gl);
      scene.environment = pm.fromEquirectangular(hdr).texture;
      scene.environmentIntensity = 0.85;
      hdr.dispose(); pm.dispose(); doneHdr();
    }, undefined, doneHdr);
    scene.fog = new THREE.FogExp2('#c8d3dc', 0.0009);
    return () => { scene.fog = null; };
  }, [scene, gl, mobile]);

  const tmp = useMemo(() => ({ f: new THREE.Vector3(), c: new THREE.Vector3(), cool: new THREE.Color('#c6d2dc'), warm: new THREE.Color('#d9cdb7') }), []);

  useFrame(() => {
    const t = film.t;
    // shadow frustum follows what the camera looks at; scale by scene
    camera.getWorldDirection(tmp.f);
    const city = t < 21.5 || t > 55.5;
    const reach = city ? 90 : 7;
    tmp.c.copy(camera.position).addScaledVector(tmp.f, reach);
    if (!city) tmp.c.y = 1.5;
    const half = city ? 180 : 16;
    const cam = sun.shadow.camera;
    if (cam.right !== half) { cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half; cam.updateProjectionMatrix(); }
    sun.position.copy(tmp.c).addScaledVector(SUN_DIR, city ? 420 : 60);
    sun.target.position.copy(tmp.c); sun.target.updateMatrixWorld();
    sun.shadow.camera.far = city ? 900 : 140;
    sun.shadow.camera.updateProjectionMatrix();
    // atmosphere: cool clear district -> warm hazier everyday site (as the camera descends) -> clears slightly in Scene 3
    const warm = smooth(span(t, 19.5, 22.8)) * (1 - 0.35 * smooth(span(t, 37.5, 41)));
    const fog = scene.fog as THREE.FogExp2 | null;
    if (fog) {
      fog.color.copy(tmp.cool).lerp(tmp.warm, warm);
      fog.density = lerp(0.00085, 0.00075, warm) * (t > 54 ? lerp(1, 0.32, smooth(span(t, 54, 57.5))) : 1);
    }
    sun.color.setRGB(1, lerp(0.965, 0.93, warm), lerp(0.93, 0.84, warm));
    sun.intensity = lerp(3.4, 3.0, warm);
    fill.intensity = lerp(0.35, 0.42, warm);
  });

  return (
    <>
      <primitive object={sun} />
      <primitive object={sun.target} />
      <primitive object={fill} />
    </>
  );
}
