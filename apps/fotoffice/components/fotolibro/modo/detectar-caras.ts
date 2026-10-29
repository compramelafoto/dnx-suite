"use client";

import type { Cara } from "@/lib/fotolibro/modo/caras";

/**
 * Detección de caras en el navegador, con MediaPipe (de Google, gratuito). Corre en la
 * computadora de quien arma el libro: no usa servidores ni servicios pagos.
 *
 * Se carga desde su CDN y recién la primera vez que hace falta (unos 2 MB entre programa y
 * modelo), para no sumar una dependencia al proyecto ni peso a la página. Si no se puede cargar
 * (sin internet, navegador viejo), el libro funciona igual, sin encuadre por caras.
 */

const VERSION = "0.10.14";
const BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const MODELO = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
/** Se busca en una copia de este lado mayor: alcanza para caras y es rápido. */
const LADO = 1024;

type Deteccion = { boundingBox?: { originX: number; originY: number; width: number; height: number } };
type Detector = { detect: (img: HTMLCanvasElement) => { detections: Deteccion[] } };

let detector: Promise<Detector | null> | null = null;

function cargar(): Promise<Detector | null> {
  detector ??= (async () => {
    try {
      // `import()` de una dirección externa, fuera del empaquetador de Next.
      const importar = new Function("u", "return import(u)") as (u: string) => Promise<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
      const vision = await importar(`${BASE}/vision_bundle.mjs`);
      const archivos = await vision.FilesetResolver.forVisionTasks(`${BASE}/wasm`);
      return (await vision.FaceDetector.createFromOptions(archivos, {
        baseOptions: { modelAssetPath: MODELO, delegate: "CPU" },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.55,
      })) as Detector;
    } catch {
      return null;
    }
  })();
  return detector;
}

/** Las caras de una imagen, en proporción de la imagen. `null` si no se pudo buscar. */
export async function detectarCaras(imagen: ImageBitmap): Promise<Cara[] | null> {
  const d = await cargar();
  if (!d) return null;
  const escala = Math.min(1, LADO / Math.max(imagen.width, imagen.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(imagen.width * escala));
  canvas.height = Math.max(1, Math.round(imagen.height * escala));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(imagen, 0, 0, canvas.width, canvas.height);
  try {
    const { detections } = d.detect(canvas);
    return detections
      .map((x) => x.boundingBox)
      .filter((b): b is NonNullable<Deteccion["boundingBox"]> => Boolean(b))
      .map((b) => ({ x: b.originX / canvas.width, y: b.originY / canvas.height, w: b.width / canvas.width, h: b.height / canvas.height }));
  } catch {
    return null;
  }
}

/** Para fotos ya subidas: baja su vista (liviana) y busca las caras. */
export async function detectarCarasDeUrl(url: string): Promise<Cara[] | null> {
  try {
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) return null;
    const bitmap = await createImageBitmap(await r.blob());
    try {
      return await detectarCaras(bitmap);
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}
