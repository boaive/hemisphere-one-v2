import { useFrame } from '@react-three/fiber';
import { CameraRig } from './film/CameraRig';
import { Atmosphere } from './world/Atmosphere';
import { Landscape } from './world/Landscape';
import { Tower } from './world/Tower';
import { Precast } from './world/Precast';
import { DataCenter } from './world/campus/DataCenter';
import { Campus } from './world/campus/Campus';
import { Township } from './world/campus/Township';
import { Site } from './world/Site';
import { Humans } from './world/Humans';
import { Network } from './world/Network';
import { Post } from './fx/Post';
import { film } from './film/clock';
import { SCAN } from './world/materials';
import { PRECAST, DATACENTER } from './film/shots';

/**
 * Scene 1 data ripples: each flagship project sends a thin wavefront across the district every few seconds while it
 * assembles. Deterministic in film time (ripple radius = age x speed).
 */
const SOURCES: [number, number, number][] = [[0, 0, 0.0], [PRECAST.x, PRECAST.z, 1.7], [DATACENTER.x, DATACENTER.z, 3.3]];
const PERIOD = 5.0, SPEED = 62;
function DistrictFx() {
  useFrame(() => {
    const on = film.scene === 1;
    SCAN.uScanStrength.value = on ? 1 : 0;
    const t = film.t;
    SOURCES.forEach(([x, z, o], i) => {
      const age = t - o < 0 ? -1 : (t - o) % PERIOD;
      SCAN.uRip.value[i].set(x, 0, z, on && age >= 0 ? age * SPEED : -1);
    });
    SCAN.uRip.value[3].w = -1;
  });
  return null;
}

export function Scene({ draft = false }: { draft?: boolean }) {
  return (
    <>
      <CameraRig />
      <Atmosphere />
      <Landscape />
      <Tower />
      <Precast />
      <DataCenter />
      <Campus />
      <Township />
      <Site />
      <Humans />
      <Network />
      <DistrictFx />
      <Post draft={draft} />
    </>
  );
}
