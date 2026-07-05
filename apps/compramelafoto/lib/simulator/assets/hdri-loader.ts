/**
 * Carga de HDRI para iluminación image-based (IBL).
 * Soporta .hdr (RGBE); extensible a EXR.
 */

import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

let sharedRgbLoader: RGBELoader | null = null;

function getRgbELoader(): RGBELoader {
  if (!sharedRgbLoader) {
    sharedRgbLoader = new RGBELoader();
  }
  return sharedRgbLoader;
}

export interface HdriLoadOptions {
  /** Equirectangular → cubemap para PMREM. */
  pmremTargetSize?: number;
}

export interface HdriEnvironmentMaps {
  texture: THREE.DataTexture;
  envMap: THREE.Texture;
}

/**
 * Carga un HDRI y genera envMap listo para `scene.environment`.
 */
export async function loadHdriEnvironment(
  url: string,
  renderer: THREE.WebGLRenderer,
  options: HdriLoadOptions = {},
): Promise<HdriEnvironmentMaps> {
  const loader = getRgbELoader();
  const texture = await loader.loadAsync(url);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const renderTarget = pmrem.fromEquirectangular(texture);
  pmrem.dispose();

  return {
    texture,
    envMap: renderTarget.texture,
  };
}

export { assetFileExists as hdriFileExists } from "./asset-file-exists";
