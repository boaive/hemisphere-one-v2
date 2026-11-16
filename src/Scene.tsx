import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraRig } from './film/CameraRig';
import { Atmosphere } from './world/Atmosphere';
import { Landscape } from './world/Landscape';
import { Tower } from './world/Tower';
import { Precast } from './world/Precast';
import { Factory } from './world/Factory';
import { Site } from './world/Site';
import { Humans } from './world/Humans';
import { Network } from './world/Network';
import { Post } from './fx/Post';
import { film } from './film/clock';
import { updateSound } from './audio/sfx';

/** compile every shader once (everything visible for one frame) so nothing hitches mid-film */
function Warmup({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree();
  const n = useRef(0);
  useFrame(() => {
    n.current++;
    if (n.current === 2) {
      const hidden: { visible: boolean }[] = [];
      scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
      gl.compile(scene, camera);
      hidden.forEach((o) => (o.visible = false));
    }
    if (n.current === 4) onReady();
    updateSound(film.t, film.sound);
  });
  return null;
}

export function Scene({ mobile, quality, onReady }: { mobile: boolean; quality: number; onReady: () => void }) {
  return (
    <>
      <CameraRig />
      <Atmosphere mobile={mobile} />
      <Landscape mobile={mobile} />
      <Tower />
      <Precast />
      <Factory />
      <Site />
      <Humans />
      <Network />
      <Post mobile={mobile} quality={quality} />
      <Warmup onReady={onReady} />
    </>
  );
}
