/**
 * Postproceso de capturas: barrido horizontal (panning).
 * La profundidad de campo se aplica en el pipeline de render (DepthOfFieldPass).
 */

import { buildDofPedagogyNotes } from "./depth-of-field";
import {
  buildPanningPedagogyNotes,
  type PanningResult,
  isPanningShutterEligible,
} from "./panning";
import {
  buildZoomPedagogyNotes,
  type ZoomExposureResult,
} from "./zoom-exposure";

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CapturePostProcessInput {
  sourceUrl: string;
  aperture: number;
  focalLengthMm: number;
  shutterSeconds: number;
  panning: PanningResult;
  subjectScreenRect: ScreenRect | null;
  zoom: ZoomExposureResult;
}

export interface CapturePostProcessOutput {
  url: string;
  pedagogyNotes: string[];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la captura"));
    img.src = url;
  });
}

function horizontalBlur(
  source: CanvasImageSource,
  width: number,
  height: number,
  radiusPx: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const passes = Math.max(1, Math.round(radiusPx / 3));
  const step = Math.max(2, Math.round(radiusPx));

  ctx.drawImage(source, 0, 0, width, height);
  for (let p = 0; p < passes; p += 1) {
    const temp = document.createElement("canvas");
    temp.width = width;
    temp.height = height;
    const tctx = temp.getContext("2d");
    if (!tctx) break;
    tctx.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, width, height);
    for (let offset = -step; offset <= step; offset += step) {
      ctx.globalAlpha = 1 / (passes * Math.floor((2 * step) / step + 1));
      ctx.drawImage(temp, offset, 0);
    }
    ctx.globalAlpha = 1;
  }
  return canvas;
}

function radialMaskComposite(
  base: CanvasImageSource,
  sharp: CanvasImageSource,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) return out;

  ctx.drawImage(base, 0, 0, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(sharp, 0, 0, width, height);
  ctx.restore();
  return out;
}

function applyPanningEffect(
  source: HTMLCanvasElement,
  width: number,
  height: number,
  panning: PanningResult,
  subjectScreenRect: ScreenRect | null,
  shutterSeconds: number,
): HTMLCanvasElement {
  if (!isPanningShutterEligible(shutterSeconds) || !panning.detected) {
    return source;
  }

  if (!panning.subjectFollowed) {
    return source;
  }

  const exposureFactor = Math.min(1, shutterSeconds / 0.125);
  const matchBoost = 1 + panning.panningMatch * 0.35;
  const blurStrength = (10 + exposureFactor * 28) * matchBoost;

  const rect = subjectScreenRect;
  if (!rect) return source;

  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const rx = rect.width * 0.58;
  const ry = rect.height * 0.52;

  const streaked = horizontalBlur(source, width, height, blurStrength);
  const sharpSource =
    panning.panningMatch > 0.68
      ? source
      : horizontalBlur(source, width, height, Math.max(1, blurStrength * 0.12));
  return radialMaskComposite(streaked, sharpSource, width, height, cx, cy, rx, ry);
}

/**
 * Postproceso radial simple para zoom durante exposición.
 * TODO: zoom blur radial real, acumulación con cambios de FOV.
 */
function applyZoomDuringExposureEffect(
  source: HTMLCanvasElement,
  width: number,
  height: number,
  zoom: ZoomExposureResult,
): HTMLCanvasElement {
  if (!zoom.detected) return source;

  const zoomIn = zoom.endFocalLength > zoom.startFocalLength;
  const deltaRatio =
    Math.abs(zoom.endFocalLength - zoom.startFocalLength) /
    Math.max(zoom.startFocalLength, 1);
  const strength = Math.min(28, 8 + deltaRatio * 40);

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) return source;

  const cx = width / 2;
  const cy = height / 2;
  ctx.drawImage(source, 0, 0, width, height);

  const layers = 6;
  for (let i = 1; i <= layers; i += 1) {
    const t = i / layers;
    const scale = zoomIn ? 1 + t * strength * 0.004 : 1 - t * strength * 0.004;
    const alpha = 0.12 / layers;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    ctx.drawImage(source, 0, 0, width, height);
    ctx.restore();
  }

  ctx.globalAlpha = 1;
  return out;
}

export async function postprocessCapture(
  input: CapturePostProcessInput,
): Promise<CapturePostProcessOutput> {
  const img = await loadImage(input.sourceUrl);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;

  const base = document.createElement("canvas");
  base.width = width;
  base.height = height;
  const bctx = base.getContext("2d");
  if (!bctx) {
    return { url: input.sourceUrl, pedagogyNotes: [] };
  }
  bctx.drawImage(img, 0, 0, width, height);

  const processedPan = applyPanningEffect(
    base,
    width,
    height,
    input.panning,
    input.subjectScreenRect,
    input.shutterSeconds,
  );

  const processed = applyZoomDuringExposureEffect(
    processedPan,
    width,
    height,
    input.zoom,
  );

  const pedagogyNotes = [
    ...buildPanningPedagogyNotes(input.panning),
    ...buildZoomPedagogyNotes(input.zoom),
    ...buildDofPedagogyNotes(input.aperture, input.focalLengthMm),
  ];

  return {
    url: processed.toDataURL("image/jpeg", 0.9),
    pedagogyNotes,
  };
}

export function worldToCaptureRect(
  worldX: number,
  worldY: number,
  worldZ: number,
  project: (x: number, y: number, z: number) => { x: number; y: number; visible: boolean } | null,
  captureWidth: number,
  captureHeight: number,
  padding = 1.35,
): ScreenRect | null {
  const center = project(worldX, worldY, worldZ);
  if (!center?.visible) return null;

  const halfW = captureWidth * 0.12 * padding;
  const halfH = captureHeight * 0.08 * padding;

  return {
    x: Math.max(0, center.x - halfW),
    y: Math.max(0, center.y - halfH),
    width: Math.min(captureWidth, halfW * 2),
    height: Math.min(captureHeight, halfH * 2),
  };
}
