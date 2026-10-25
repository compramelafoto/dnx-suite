/**
 * Celulares: las texturas de la ciudad ocupan ~1,7 GB en la placa de video y
 * Chrome en Android cierra la pestaña ("¡Oh, no!"). Acá se achica cada imagen
 * apenas se decodifica (antes de subirla y sin guardar la original), así la
 * memoria queda en una fracción.
 */

import * as THREE from "three";

/** Lado máximo de textura en el celular según la memoria del teléfono. */
export function mobileTextureCap(): number {
  const memoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  return memoryGb <= 4 ? 192 : 256;
}

/** Medidas achicadas para que el lado mayor no pase de `cap` (null si ya entra). */
export function cappedSize(width: number, height: number, cap: number): { width: number; height: number } | null {
  const longest = Math.max(width, height);
  if (longest <= cap || longest === 0) return null;
  const k = cap / longest;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

let installed = false;

/** Intercepta los cargadores de imágenes de three.js (GLTF y texturas sueltas). */
export function installTextureCap(cap: number) {
  if (installed) return;
  installed = true;

  // GLTFLoader en Chrome decodifica a ImageBitmap.
  const bitmapLoad = THREE.ImageBitmapLoader.prototype.load;
  THREE.ImageBitmapLoader.prototype.load = function (url, onLoad, onProgress, onError) {
    return bitmapLoad.call(
      this,
      url,
      (bitmap) => {
        const size = cappedSize(bitmap.width, bitmap.height, cap);
        if (!size || !onLoad) return onLoad?.(bitmap);
        createImageBitmap(bitmap, { resizeWidth: size.width, resizeHeight: size.height, resizeQuality: "medium" })
          .then((small) => {
            bitmap.close();
            onLoad(small);
          })
          .catch(() => onLoad(bitmap));
      },
      onProgress,
      onError,
    );
  };

  // Texturas sueltas (piso, veredas) y GLTF en Safari: HTMLImageElement → lienzo chico.
  const imageLoad = THREE.ImageLoader.prototype.load;
  THREE.ImageLoader.prototype.load = function (url, onLoad, onProgress, onError) {
    return imageLoad.call(
      this,
      url,
      (image) => {
        const size = cappedSize(image.naturalWidth || image.width, image.naturalHeight || image.height, cap);
        if (!size || !onLoad) return onLoad?.(image);
        const canvas = document.createElement("canvas");
        canvas.width = size.width;
        canvas.height = size.height;
        const g = canvas.getContext("2d");
        if (!g) return onLoad(image);
        g.drawImage(image, 0, 0, size.width, size.height);
        onLoad(canvas as unknown as HTMLImageElement);
      },
      onProgress,
      onError,
    );
  };
}
