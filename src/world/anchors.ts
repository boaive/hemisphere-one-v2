import * as THREE from 'three';

/**
 * World-space anchors for tracked labels. 3D components update positions; the camera rig projects
 * them to screen pixels every frame; the HTML overlay reads `screen` without React re-renders.
 */
export type Anchor = { world: THREE.Vector3; screen: { x: number; y: number; visible: boolean; depth: number } };
export const anchors: Record<string, Anchor> = {};

export function anchor(id: string, x = 0, y = 0, z = 0) {
  if (!anchors[id]) anchors[id] = { world: new THREE.Vector3(x, y, z), screen: { x: 0, y: 0, visible: false, depth: 0 } };
  else anchors[id].world.set(x, y, z);
  return anchors[id];
}

const v = new THREE.Vector3();
export function projectAnchors(cam: THREE.Camera, w: number, h: number) {
  for (const k in anchors) {
    const a = anchors[k];
    v.copy(a.world).project(cam);
    a.screen.visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    a.screen.x = (v.x * 0.5 + 0.5) * w;
    a.screen.y = (-v.y * 0.5 + 0.5) * h;
    a.screen.depth = v.z;
  }
}
