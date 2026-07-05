import { ALBUM_PHOTO_PROXY_UPLOAD_MAX_BYTES } from "@/lib/albums/album-photo-upload-limits";
import {
  isLikelyMobileUploadDevice,
  resolveAlbumPhotoContentType,
} from "@/lib/albums/album-photo-content-type";

/** Objetivo bajo el límite del proxy en Vercel (~4 MB). */
export const MOBILE_PROXY_TARGET_BYTES = Math.floor(
  ALBUM_PHOTO_PROXY_UPLOAD_MAX_BYTES * 0.9
);

const EDGE_STEPS_PX = [2560, 2048, 1600, 1280, 1024, 800];
const QUALITY_STEPS = [0.88, 0.78, 0.68, 0.58, 0.48, 0.38];

const COMPRESSIBLE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const MOBILE_UPLOAD_TOO_LARGE_MESSAGE =
  "Esta foto es muy pesada para subirla desde el celular. Probá desde computadora o elegí una versión más liviana.";

/**
 * Copia el archivo a memoria antes de subir.
 * En iOS/Android los File del input pueden volverse ilegibles tras muchas lecturas o minutos de espera.
 */
export async function snapshotUploadFile(file: File): Promise<File> {
  try {
    const buffer = await file.arrayBuffer();
    if (!buffer.byteLength) {
      throw new Error("Archivo vacío o no disponible");
    }
    const type =
      resolveAlbumPhotoContentType(file.name, file.type) ||
      file.type ||
      "application/octet-stream";
    return new File([buffer], file.name, {
      type,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

async function loadImageForCanvas(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("No se pudo leer la imagen"));
      el.src = objectUrl;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

function scaledDimensions(
  width: number,
  height: number,
  maxEdge: number
): { w: number; h: number } {
  const edge = Math.max(width, height);
  if (edge <= maxEdge) return { w: width, h: height };
  const scale = maxEdge / edge;
  return {
    w: Math.max(1, Math.round(width * scale)),
    h: Math.max(1, Math.round(height * scale)),
  };
}

async function renderJpegBlob(
  source: CanvasImageSource,
  width: number,
  height: number,
  quality: number
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, width, height);
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
}

async function compressImageForMobileProxy(file: File): Promise<File | null> {
  const { source, width, height, cleanup } = await loadImageForCanvas(file);
  try {
    let bestBlob: Blob | null = null;

    for (const maxEdge of EDGE_STEPS_PX) {
      const { w, h } = scaledDimensions(width, height, maxEdge);
      for (const quality of QUALITY_STEPS) {
        const blob = await renderJpegBlob(source, w, h, quality);
        if (!blob) continue;
        bestBlob = blob;
        if (blob.size <= MOBILE_PROXY_TARGET_BYTES) break;
      }
      if (bestBlob && bestBlob.size <= MOBILE_PROXY_TARGET_BYTES) break;
    }

    if (!bestBlob || bestBlob.size > ALBUM_PHOTO_PROXY_UPLOAD_MAX_BYTES) {
      return null;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([bestBlob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } finally {
    cleanup();
  }
}

/**
 * En móvil, reduce fotos grandes para que entren por proxy-upload (evita PUT directo a R2).
 */
export async function prepareMobileAlbumPhotoForUpload(file: File): Promise<File> {
  if (!isLikelyMobileUploadDevice()) return file;
  if (file.size <= ALBUM_PHOTO_PROXY_UPLOAD_MAX_BYTES) return file;

  const contentType = resolveAlbumPhotoContentType(file.name, file.type);
  if (!COMPRESSIBLE_TYPES.has(contentType)) return file;

  try {
    const compressed = await compressImageForMobileProxy(file);
    return compressed ?? file;
  } catch {
    return file;
  }
}

/**
 * Snapshot + compresión por archivo (una a la vez, sin cargar todo el lote en memoria).
 */
export async function prepareMobileUploadFileForQueue(file: File): Promise<File> {
  if (!isLikelyMobileUploadDevice()) return file;
  const snapshotted = await snapshotUploadFile(file);
  const prepared = await prepareMobileAlbumPhotoForUpload(snapshotted);
  if (prepared.size > ALBUM_PHOTO_PROXY_UPLOAD_MAX_BYTES) {
    throw new Error(MOBILE_UPLOAD_TOO_LARGE_MESSAGE);
  }
  return prepared;
}

/** @deprecated Preferir prepareMobileUploadFileForQueue por archivo en la cola. */
export async function prepareMobileAlbumPhotosForUpload(files: File[]): Promise<File[]> {
  if (!isLikelyMobileUploadDevice()) return files;
  const prepared: File[] = [];
  for (const file of files) {
    prepared.push(await prepareMobileUploadFileForQueue(file));
  }
  return prepared;
}
