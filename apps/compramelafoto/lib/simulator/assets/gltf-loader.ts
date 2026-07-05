/**
 * GLTFLoader configurado para Ciudad Fotográfica (DRACO + KTX2 opcionales).
 * No precarga modelos; expone factory para slots de manzana.
 */

import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getKtx2Loader } from "./ktx2-loader";

const DRACO_DECODER_PATH = "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";

let sharedDracoLoader: DRACOLoader | null = null;

function getDracoLoader(): DRACOLoader {
  if (!sharedDracoLoader) {
    sharedDracoLoader = new DRACOLoader();
    sharedDracoLoader.setDecoderPath(DRACO_DECODER_PATH);
  }
  return sharedDracoLoader;
}

export interface GltfLoaderOptions {
  /** Habilita KTX2 en materiales glTF (requiere renderer WebGL). */
  ktx2?: boolean;
  /** Habilita geometría Draco comprimida. */
  draco?: boolean;
}

/**
 * Crea un GLTFLoader listo para assets fotográficos.
 */
export function createGltfLoader(
  renderer: THREE.WebGLRenderer,
  options: GltfLoaderOptions = { ktx2: true, draco: true },
): GLTFLoader {
  const loader = new GLTFLoader();

  if (options.draco !== false) {
    loader.setDRACOLoader(getDracoLoader());
  }

  if (options.ktx2 !== false) {
    loader.setKTX2Loader(getKtx2Loader(renderer));
  }

  return loader;
}

export type GltfLoadResult = Awaited<ReturnType<GLTFLoader["loadAsync"]>>;
