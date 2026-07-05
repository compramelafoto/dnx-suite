import type * as THREE from "three";

export type SimulatorFrameRenderer = (
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
) => void;

let activeRenderer: SimulatorFrameRenderer | null = null;

export function registerSimulatorFrameRenderer(renderer: SimulatorFrameRenderer | null): void {
  activeRenderer = renderer;
}

export function renderSimulatorFrame(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): void {
  if (activeRenderer) {
    activeRenderer(gl, scene, camera);
    return;
  }
  gl.setRenderTarget(null);
  gl.render(scene, camera);
}
