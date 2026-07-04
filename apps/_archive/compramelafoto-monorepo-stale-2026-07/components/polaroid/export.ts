import JSZip from "jszip";
import { safeFilename } from "@/lib/safe-filename";
import { getTextureById, getTextureUrl } from "./textures";
import type { PolaroidPreset, PolaroidPresetId } from "./presets";
import { getPolaroidLayoutCm, POLAROID_PRESETS } from "./presets";
import { getPolaroidFontFamily, POLAROID_FONT_FALLBACK } from "./fonts";

export type CropAreaPixels = { x: number; y: number; width: number; height: number };

export type PolaroidText = {
  id: string;
  value: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  rotation: number;
  align: CanvasTextAlign;
  x: number;
  y: number;
  bold?: boolean;
  italic?: boolean;
  strokeWidth?: number;
  strokeColor?: string;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
};

export type PolaroidItem = {
  id: string;
  imageSrc: string;
  crop: { x: number; y: number };
  zoom: number;
  cropPixels: CropAreaPixels | null;
  textureId: string;
  textureSeed: string;
  textureScale?: number;
  textureRotation?: number;
  textureOffsetX?: number;
  textureOffsetY?: number;
  texts: PolaroidText[];
  copies: number;
  presetId: PolaroidPresetId;
  finish: "BRILLO" | "MATE";
};

const CM_PER_INCH = 2.54;

export function cmToPx(cm: number, dpi = 300) {
  return Math.round((cm / CM_PER_INCH) * dpi);
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    image.crossOrigin = "anonymous";
    image.src = src;
  });
}

const textureCache = new Map<string, Promise<HTMLImageElement>>();

function loadTextureImage(url: string): Promise<HTMLImageElement> {
  if (!textureCache.has(url)) {
    textureCache.set(
      url,
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("No se pudo cargar la textura"));
        image.crossOrigin = "anonymous";
        image.src = url;
      })
    );
  }
  return textureCache.get(url)!;
}

function hashSeed(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getPolaroidFrame(widthPx: number, heightPx: number) {
  const side = Math.round(widthPx * 0.06);
  const top = Math.round(heightPx * 0.06);
  const bottom = Math.round(heightPx * 0.22);
  const photoWidth = widthPx - side * 2;
  const photoHeight = heightPx - top - bottom;
  return {
    side,
    top,
    bottom,
    photoX: side,
    photoY: top,
    photoWidth,
    photoHeight,
  };
}

async function drawBorderTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: ReturnType<typeof getPolaroidFrame>,
  textureId: string,
  seed: string,
  options?: {
    scale?: number;
    rotation?: number;
    offsetX?: number;
    offsetY?: number;
  }
) {
  const texture = getTextureById(textureId);
  if (!texture.filename) return;
  const url = getTextureUrl(texture);
  if (!url) return;
  const image = await loadTextureImage(url);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.rect(frame.photoX, frame.photoY, frame.photoWidth, frame.photoHeight);
  ctx.clip("evenodd");
  ctx.globalAlpha = 0.75;
  const imageWidth = Math.max(1, image.naturalWidth);
  const imageHeight = Math.max(1, image.naturalHeight);
  const longSide = Math.max(imageWidth, imageHeight);
  // Adaptar textura al lado largo (alto) de la foto polaroid
  // Usar height (alto completo) en lugar del lado más corto
  const baseScale = Math.min(1, height / longSide);
  const scale = baseScale * Math.max(0.3, Math.min(3, options?.scale ?? 1));
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const rotation = ((options?.rotation ?? 0) * Math.PI) / 180;
  const offsetX = (options?.offsetX ?? 0) * width;
  const offsetY = (options?.offsetY ?? 0) * height;
  ctx.translate(width / 2 + offsetX, height / 2 + offsetY);
  ctx.rotate(rotation);
  ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

export async function renderPolaroidToCanvas(
  item: PolaroidItem,
  preset: PolaroidPreset,
  dpi = 300
): Promise<HTMLCanvasElement> {
  const widthPx = cmToPx(preset.widthCm, dpi);
  const heightPx = cmToPx(preset.heightCm, dpi);
  const frame = getPolaroidFrame(widthPx, heightPx);
  const canvas = document.createElement("canvas");
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, widthPx, heightPx);

  await drawBorderTexture(
    ctx,
    widthPx,
    heightPx,
    frame,
    item.textureId,
    item.textureSeed || item.id,
    {
      scale: item.textureScale,
      rotation: item.textureRotation,
      offsetX: item.textureOffsetX,
      offsetY: item.textureOffsetY,
    }
  );

  // Asegurar fuentes cargadas antes de dibujar texto en canvas.
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const image = await loadImage(item.imageSrc);
  const crop = item.cropPixels ?? { x: 0, y: 0, width: image.width, height: image.height };
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const sx = crop.x * scaleX;
  const sy = crop.y * scaleY;
  const sWidth = crop.width * scaleX;
  const sHeight = crop.height * scaleY;
  ctx.drawImage(image, sx, sy, sWidth, sHeight, frame.photoX, frame.photoY, frame.photoWidth, frame.photoHeight);

  item.texts.forEach((text) => {
    if (!text.value.trim()) return;
    ctx.save();
    ctx.fillStyle = text.color;
    const weight = text.bold ? "bold " : "";
    const style = text.italic ? "italic " : "";
    const family = getPolaroidFontFamily(text.fontFamily);
    // Fallback seguro si alguna fuente no carga.
    ctx.font = `${style}${weight}${text.fontSize}px "${family}", ${POLAROID_FONT_FALLBACK}`;
    // Efectos: sombra y borde.
    if (text.shadowBlur && text.shadowBlur > 0) {
      ctx.shadowColor = text.shadowColor || "rgba(0,0,0,0.35)";
      ctx.shadowBlur = text.shadowBlur;
      ctx.shadowOffsetX = text.shadowOffsetX ?? 0;
      ctx.shadowOffsetY = text.shadowOffsetY ?? 2;
    }
    ctx.textAlign = text.align;
    ctx.textBaseline = "middle";
    const textX = text.x * widthPx;
    const textY = text.y * heightPx;
    ctx.translate(textX, textY);
    ctx.rotate((text.rotation * Math.PI) / 180);
    if (text.strokeWidth && text.strokeWidth > 0) {
      ctx.lineWidth = text.strokeWidth;
      ctx.strokeStyle = text.strokeColor || "#111111";
      ctx.strokeText(text.value, 0, 0);
    }
    ctx.fillText(text.value, 0, 0);
    ctx.restore();
  });

  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, widthPx - 1, heightPx - 1);

  return canvas;
}

export function renderSheetToCanvas(
  polaroids: HTMLCanvasElement[],
  preset: PolaroidPreset,
  dpi = 300
): HTMLCanvasElement {
  const sheetWidthPx = cmToPx(preset.sheet.widthCm, dpi);
  const sheetHeightPx = cmToPx(preset.sheet.heightCm, dpi);
  const layout = getPolaroidLayoutCm(preset);
  const layoutWidthPx = cmToPx(layout.widthCm, dpi);
  const layoutHeightPx = cmToPx(layout.heightCm, dpi);
  const canvas = document.createElement("canvas");
  canvas.width = sheetWidthPx;
  canvas.height = sheetHeightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sheetWidthPx, sheetHeightPx);

  const count = polaroids.length;
  const totalHeight = count * layoutHeightPx;
  const startY = Math.round((sheetHeightPx - totalHeight) / 2);
  const startX = Math.round((sheetWidthPx - layoutWidthPx) / 2);

  polaroids.forEach((polaroidCanvas, index) => {
    const x = startX;
    const y = startY + index * layoutHeightPx;
    ctx.save();
    if (preset.rotateForSheet) {
      ctx.translate(x + layoutWidthPx / 2, y + layoutHeightPx / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(
        polaroidCanvas,
        -polaroidCanvas.width / 2,
        -polaroidCanvas.height / 2
      );
    } else {
      ctx.drawImage(polaroidCanvas, x, y, layoutWidthPx, layoutHeightPx);
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, layoutWidthPx - 1, layoutHeightPx - 1);
  });

  // Guías de corte hasta los bordes de la hoja.
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < polaroids.length; i += 1) {
    const y = startY + i * layoutHeightPx;
    ctx.moveTo(0.5, y + 0.5);
    ctx.lineTo(sheetWidthPx - 0.5, y + 0.5);
    ctx.moveTo(0.5, y + layoutHeightPx - 0.5);
    ctx.lineTo(sheetWidthPx - 0.5, y + layoutHeightPx - 0.5);
  }
  ctx.moveTo(startX + 0.5, 0.5);
  ctx.lineTo(startX + 0.5, sheetHeightPx - 0.5);
  ctx.moveTo(startX + layoutWidthPx - 0.5, 0.5);
  ctx.lineTo(startX + layoutWidthPx - 0.5, sheetHeightPx - 0.5);
  ctx.stroke();

  // Íconos de tijera en las guías.
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("✂", startX + 4, 4);
  ctx.fillText("✂", startX + layoutWidthPx + 4, 4);
  ctx.restore();

  return canvas;
}

export async function exportSheetsAsZip(
  items: PolaroidItem[]
): Promise<{ blob: Blob; filename: string }> {
  const zip = new JSZip();
  const presetsById = new Map(POLAROID_PRESETS.map((preset) => [preset.id, preset]));
  const grouped: Map<
    string,
    { preset: PolaroidPreset; finishName: string; canvases: HTMLCanvasElement[] }
  > = new Map();

  const safeName = (name: string) => safeFilename(name, "archivo");

  for (const item of items) {
    const preset = presetsById.get(item.presetId) ?? POLAROID_PRESETS[0];
    const count = Math.max(1, Math.round(item.copies || 1));
    const finishName = safeName(item.finish || "BRILLO");
    const groupKey = `${preset.id}__${item.finish || "BRILLO"}`;
    for (let i = 0; i < count; i += 1) {
      const canvas = await renderPolaroidToCanvas(item, preset, 300);
      const bucket =
        grouped.get(groupKey) ?? { preset, finishName, canvases: [] };
      bucket.canvases.push(canvas);
      grouped.set(groupKey, bucket);
    }
  }

  const sheets: Array<{
    preset: PolaroidPreset;
    finishName: string;
    canvas: HTMLCanvasElement;
    index: number;
  }> = [];
  grouped.forEach(({ preset, finishName, canvases }) => {
    const perSheet = preset.maxPerSheet ?? 2;
    for (let i = 0; i < canvases.length; i += perSheet) {
      const group = canvases.slice(i, i + perSheet);
      sheets.push({
        preset,
        finishName,
        canvas: renderSheetToCanvas(group, preset, 300),
        index: Math.floor(i / perSheet) + 1,
      });
    }
  });

  for (const entry of sheets) {
    const blob = await new Promise<Blob>((resolve) => {
      entry.canvas.toBlob((b) => resolve(b || new Blob()), "image/png");
    });
    const sizeLabel = safeName(`${entry.preset.sheet.label}`);
    const finishLabel = safeName(entry.finishName);
    const index = String(entry.index).padStart(3, "0");
    const baseFolder = "Impresion de fotografias";
    const filename = `Hoja - ${finishLabel} - ${sizeLabel} - ${index}.png`;
    const zipPath = `${baseFolder}/${finishLabel}/${sizeLabel}/${filename}`;
    zip.file(zipPath, blob);
  }

  const now = new Date();
  const stamp =
    [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("") +
    "_" +
    [now.getHours(), now.getMinutes()].map((v) => String(v).padStart(2, "0")).join("");
  const filename = `impresion_fotografias_${stamp}.zip`;
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, filename };
}
