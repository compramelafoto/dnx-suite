/**
 * Captura con acumulación temporal para simular motion blur en exposiciones largas.
 *
 * Durante el tiempo de exposición se promedian varios fotogramas mientras la escena
 * sigue avanzando (cámara del fotógrafo + objetos en movimiento).
 */

import { getViewfinderCropRect } from "./viewfinder-frame";

/** A partir de 1/60 s se acumulan muestras (motion blur pedagógico). */
export const MOTION_BLUR_SHUTTER_SEC = 1 / 60;

const CAPTURE_SCALE = 0.65;
const MAX_SAMPLES = 96;
const MIN_SAMPLE_INTERVAL_MS = 1000 / 60;

export interface AccumulationPlan {
  durationMs: number;
  intervalMs: number;
  useMotionBlur: boolean;
}

export function needsMotionBlurCapture(shutterSeconds: number): boolean {
  return shutterSeconds >= MOTION_BLUR_SHUTTER_SEC;
}

export function getAccumulationPlan(shutterSeconds: number): AccumulationPlan {
  const durationMs = Math.max(shutterSeconds * 1000, 32);
  const useMotionBlur = needsMotionBlurCapture(shutterSeconds);
  const intervalMs = useMotionBlur
    ? Math.max(MIN_SAMPLE_INTERVAL_MS, durationMs / MAX_SAMPLES)
    : durationMs;

  return { durationMs, intervalMs, useMotionBlur };
}

export function getCapturePixelSize(canvasWidth: number, canvasHeight: number): {
  width: number;
  height: number;
} {
  const crop = getViewfinderCropRect(canvasWidth, canvasHeight);
  return {
    width: Math.max(1, Math.floor(crop.width * CAPTURE_SCALE)),
    height: Math.max(1, Math.floor(crop.height * CAPTURE_SCALE)),
  };
}

export interface FrameAccumulator {
  data: Float32Array;
  count: number;
  width: number;
  height: number;
}

export function createFrameAccumulator(width: number, height: number): FrameAccumulator {
  return {
    data: new Float32Array(width * height * 4),
    count: 0,
    width,
    height,
  };
}

function accumulateFrame(
  accumulator: FrameAccumulator,
  imageData: ImageData,
): FrameAccumulator {
  const nextCount = accumulator.count + 1;
  const inv = 1 / nextCount;
  const { data } = accumulator;

  for (let i = 0; i < data.length; i += 1) {
    data[i] += (imageData.data[i] - data[i]) * inv;
  }

  return { ...accumulator, count: nextCount };
}

/** Promedio incremental por canal RGBA. */
export function addFrameToAccumulator(
  accumulator: FrameAccumulator,
  imageData: ImageData,
): FrameAccumulator {
  return accumulateFrame(accumulator, imageData);
}

/**
 * Desplaza el fotograma en X antes de acumular (barrido: sujeto estable, fondo estriado).
 */
export function shiftImageDataHorizontal(imageData: ImageData, offsetPx: number): ImageData {
  const shift = Math.round(offsetPx);
  if (shift === 0) return imageData;

  const { width, height, data } = imageData;
  const out = new ImageData(width, height);
  const odata = out.data;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const srcX = x - shift;
      const di = (y * width + x) * 4;
      if (srcX < 0 || srcX >= width) {
        const clampX = srcX < 0 ? 0 : width - 1;
        const si = (y * width + clampX) * 4;
        odata[di] = data[si];
        odata[di + 1] = data[si + 1];
        odata[di + 2] = data[si + 2];
        odata[di + 3] = data[si + 3];
        continue;
      }
      const si = (y * width + srcX) * 4;
      odata[di] = data[si];
      odata[di + 1] = data[si + 1];
      odata[di + 2] = data[si + 2];
      odata[di + 3] = data[si + 3];
    }
  }

  return out;
}

export function addFrameToAccumulatorShifted(
  accumulator: FrameAccumulator,
  imageData: ImageData,
  offsetPx: number,
): FrameAccumulator {
  const shift = Math.round(offsetPx);
  const frame = shift === 0 ? imageData : shiftImageDataHorizontal(imageData, shift);
  return accumulateFrame(accumulator, frame);
}

export function accumulatorToDataUrl(
  accumulator: FrameAccumulator,
  exposureGain = 1,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = accumulator.width;
  canvas.height = accumulator.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const gain = Math.max(1 / 256, exposureGain);
  const imageData = ctx.createImageData(accumulator.width, accumulator.height);
  for (let i = 0; i < accumulator.data.length; i += 4) {
    imageData.data[i] = Math.min(255, Math.round(accumulator.data[i] * gain));
    imageData.data[i + 1] = Math.min(255, Math.round(accumulator.data[i + 1] * gain));
    imageData.data[i + 2] = Math.min(255, Math.round(accumulator.data[i + 2] * gain));
    imageData.data[i + 3] = Math.min(255, Math.round(accumulator.data[i + 3]));
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.9);
}
