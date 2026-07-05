/**
 * Configuración KTX2 (Basis Universal) para texturas comprimidas en glTF.
 * No carga assets; prepara el loader para uso con GLTFLoader.
 */

import * as THREE from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { COD_BASIS_ROOT } from "./paths";

let sharedKtx2Loader: KTX2Loader | null = null;

export function getKtx2TranscoderPath(): string {
  return `${COD_BASIS_ROOT}/`;
}

/**
 * Instancia singleton de KTX2Loader con transcoder en public/camofduty/basis/.
 * Llamar `setRenderer` antes del primer load.
 */
export function getKtx2Loader(renderer: THREE.WebGLRenderer): KTX2Loader {
  if (!sharedKtx2Loader) {
    sharedKtx2Loader = new KTX2Loader()
      .setTranscoderPath(getKtx2TranscoderPath())
      .detectSupport(renderer);
  } else {
    sharedKtx2Loader.detectSupport(renderer);
  }
  return sharedKtx2Loader;
}

export function disposeKtx2Loader(): void {
  sharedKtx2Loader?.dispose();
  sharedKtx2Loader = null;
}
