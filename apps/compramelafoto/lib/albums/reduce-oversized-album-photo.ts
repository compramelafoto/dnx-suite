import { resolveAlbumPhotoContentType } from "@/lib/albums/album-photo-content-type";
import { transplantExif } from "@/lib/albums/jpeg-exif";

/**
 * Reducción automática de fotos que superan el límite del álbum (10 MB),
 * hecha en la computadora del fotógrafo antes de subir.
 *
 * La foto reducida es la que después compra el cliente, así que se baja lo
 * mínimo: primero se re-comprime a resolución completa y solo si no alcanza
 * se achican las medidas. Se conservan los datos de la cámara (EXIF).
 */

/** Margen bajo el límite para no quedar justo en el borde. */
const TARGET_RATIO = 0.95;

export type ReductionStep = { scale: number; quality: number };

/** Pasos en orden de menor a mayor pérdida. */
export const REDUCTION_STEPS: ReductionStep[] = [
  { scale: 1, quality: 0.92 },
  { scale: 1, quality: 0.88 },
  { scale: 1, quality: 0.84 },
  { scale: 1, quality: 0.8 },
  { scale: 0.85, quality: 0.85 },
  { scale: 0.85, quality: 0.8 },
  { scale: 0.7, quality: 0.85 },
  { scale: 0.7, quality: 0.8 },
  { scale: 0.6, quality: 0.8 },
];

export const OVERSIZED_NOT_REDUCIBLE_MESSAGE =
  "No se pudo achicar la foto por debajo del límite. Exportala más liviana desde tu programa de edición.";

/** Solo JPG: es lo que entregan las cámaras y lo que el navegador re-codifica sin sorpresas. */
export function canAutoReduceAlbumPhoto(file: { name: string; type: string }): boolean {
  return resolveAlbumPhotoContentType(file.name, file.type) === "image/jpeg";
}

export function reductionTargetBytes(maxBytes: number): number {
  return Math.floor(maxBytes * TARGET_RATIO);
}

/**
 * Cola de a una: cada foto grande ocupa cientos de MB de memoria mientras se
 * procesa. Aunque se suban 3 en paralelo, se reduce una sola por vez.
 */
let queue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function decode(file: File): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  // createImageBitmap y <img> ya aplican la orientación EXIF a los píxeles.
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("No se pudo leer la imagen"));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function toJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

async function reduce(file: File, maxBytes: number): Promise<File> {
  const target = reductionTargetBytes(maxBytes);
  const original = new Uint8Array(await file.arrayBuffer());
  const { source, width, height, cleanup } = await decode(file);
  const canvas = document.createElement("canvas");
  try {
    let drawnScale = 0;
    for (const step of REDUCTION_STEPS) {
      if (step.scale !== drawnScale) {
        canvas.width = Math.max(1, Math.round(width * step.scale));
        canvas.height = Math.max(1, Math.round(height * step.scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error(OVERSIZED_NOT_REDUCIBLE_MESSAGE);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        drawnScale = step.scale;
      }
      const blob = await toJpegBlob(canvas, step.quality);
      if (!blob) continue;
      // El EXIF suma algunos KB: se mide con él incluido.
      const bytes = transplantExif(original, new Uint8Array(await blob.arrayBuffer()));
      if (bytes.byteLength <= target) {
        return new File([bytes as BlobPart], file.name, {
          type: "image/jpeg",
          lastModified: file.lastModified,
        });
      }
    }
    throw new Error(OVERSIZED_NOT_REDUCIBLE_MESSAGE);
  } finally {
    // Libera la memoria del canvas enseguida (fotos de 40+ MP).
    canvas.width = 0;
    canvas.height = 0;
    cleanup();
  }
}

/**
 * Si la foto supera el límite, la devuelve achicada; si no, la devuelve igual.
 * Tira error con mensaje para el fotógrafo si no se pudo.
 */
export async function reduceOversizedAlbumPhoto(file: File, maxBytes: number): Promise<File> {
  if (file.size <= maxBytes) return file;
  if (!canAutoReduceAlbumPhoto(file)) throw new Error(OVERSIZED_NOT_REDUCIBLE_MESSAGE);
  return oneAtATime(() => reduce(file, maxBytes));
}
