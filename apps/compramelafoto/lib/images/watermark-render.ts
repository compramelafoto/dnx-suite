import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { buildTiledWatermarkSvg, WATERMARK_TILED_TEXT } from "@/lib/watermarking";
import { isProtectedPreviewWatermarkEnabled, PROTECTED_PREVIEW_WATERMARK_VERSION } from "@/lib/images/protected-preview-watermark";
import {
  getPublicPhotoVariantConfig,
  type PublicPhotoVariantConfig,
  type WatermarkDensity,
} from "@/lib/images/photo-variant-config";
import { DEFAULT_CENTER_WATERMARK_TEXT } from "@/lib/images/watermark-photographer-center";

export type PublicWatermarkMode = "thumb" | "preview";
export type ClassicWatermarkMode = "thumb" | "preview" | "bought";

/** Máximo de logos watermark.png repetidos por imagen (rejilla estática). */
const MAX_PNG_WATERMARK_TILES = 12;

/** Escala logos PNG (1.23 ≈ +50 % respecto al tamaño reducido previo de 0.82). */
const PNG_LOGO_SIZE_FACTOR = 1.23;

/** Escala logo PNG en celda (modo legacy bought / compat). */
const LEGACY_WATERMARK_SCALE = 0.25 * 1.15 * 1.25 * 0.5 * PNG_LOGO_SIZE_FACTOR;
const LEGACY_PNG_OPACITY = 1;
const LEGACY_TEXT_OPACITY = 0.62;

/** Densidad del texto SVG dinámico: 0.7 = ~30 % menos capas/repeticiones visibles. */
const DYNAMIC_WATERMARK_QUANTITY_FACTOR = 0.7;

export function getDynamicWatermarkCacheVersion(): string {
  return isProtectedPreviewWatermarkEnabled()
    ? PROTECTED_PREVIEW_WATERMARK_VERSION
    : getPublicPhotoVariantConfig().dynamicCacheVersion;
}

/** Rejilla de watermark.png: como máximo 12 celdas (antes very_high = 5×5 = 25). */
function resolvePngWatermarkGrid(density: WatermarkDensity): { cols: number; rows: number } {
  switch (density) {
    case "normal":
      return { cols: 3, rows: 3 };
    case "high":
      return { cols: 4, rows: 3 };
    case "very_high":
    default:
      return { cols: 4, rows: 3 };
  }
}

function logoScaleForDensity(density: WatermarkDensity, imageWidth: number): number {
  const base = imageWidth * 0.22 * PNG_LOGO_SIZE_FACTOR;
  if (density === "normal") return base * 0.42;
  if (density === "high") return base * 0.54;
  return base * 0.64;
}

async function loadWatermarkPng(): Promise<Buffer | null> {
  const candidates = [
    path.join(process.cwd(), "assets", "watermark.png"),
    path.join(process.cwd(), "public", "watermark.png"),
    path.join(process.cwd(), "..", "assets", "watermark.png"),
    path.join(process.cwd(), "..", "public", "watermark.png"),
  ];
  for (const watermarkPath of candidates) {
    try {
      return await fs.readFile(watermarkPath);
    } catch {
      /* siguiente */
    }
  }
  console.warn("[watermark-render] watermark.png no encontrado");
  return null;
}

async function buildWatermarkLogoTile(params: {
  watermarkWidth: number;
  watermarkHeight: number;
  pngOpacity: number;
  watermarkBuffer: Buffer;
}): Promise<Buffer> {
  const resizedWatermark = await sharp(params.watermarkBuffer)
    .resize(params.watermarkWidth, params.watermarkHeight, { fit: "inside" })
    .ensureAlpha()
    .png()
    .toBuffer();

  const opacity = Math.min(1, Math.max(0, params.pngOpacity));
  if (opacity >= 0.999) {
    return resizedWatermark;
  }

  return sharp(resizedWatermark)
    .ensureAlpha()
    .linear([1, 1, 1, opacity], [0, 0, 0, 0])
    .png()
    .toBuffer();
}

async function buildLogoGridComposites(params: {
  imageWidth: number;
  imageHeight: number;
  pngOpacity: number;
  density: WatermarkDensity;
}): Promise<Array<{ input: Buffer; top: number; left: number; blend?: sharp.Blend }>> {
  const watermarkBuffer = await loadWatermarkPng();
  if (!watermarkBuffer) return [];

  const { cols, rows } = resolvePngWatermarkGrid(params.density);
  const tileCount = cols * rows;
  if (tileCount > MAX_PNG_WATERMARK_TILES) {
    console.warn("[watermark-render] png_grid_exceeds_max", { cols, rows, tileCount });
  }
  const cellWidth = Math.max(1, Math.floor(params.imageWidth / cols));
  const cellHeight = Math.max(1, Math.floor(params.imageHeight / rows));
  const maxW = Math.max(
    1,
    Math.min(Math.floor(logoScaleForDensity(params.density, params.imageWidth)), cellWidth - 2, params.imageWidth - 2)
  );
  const watermarkMetadata = await sharp(watermarkBuffer).metadata();
  if (!watermarkMetadata.width || !watermarkMetadata.height) return [];

  const watermarkWidth = maxW;
  const watermarkHeight = Math.min(
    Math.floor((watermarkMetadata.height * watermarkWidth) / watermarkMetadata.width),
    Math.max(1, Math.floor(logoScaleForDensity(params.density, params.imageHeight))),
    cellHeight - 2
  );
  if (watermarkWidth <= 1 || watermarkHeight <= 1) return [];

  const logoTile = await buildWatermarkLogoTile({
    watermarkBuffer,
    watermarkWidth,
    watermarkHeight,
    pngOpacity: params.pngOpacity,
  });

  const composites: Array<{ input: Buffer; top: number; left: number; blend?: sharp.Blend }> = [];
  const offsetX = Math.max(0, Math.floor((cellWidth - watermarkWidth) / 2));
  const offsetY = Math.max(0, Math.floor((cellHeight - watermarkHeight) / 2));

  tileLoop: for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (composites.length >= MAX_PNG_WATERMARK_TILES) break tileLoop;
      composites.push({
        input: logoTile,
        top: Math.max(0, row * cellHeight + offsetY),
        left: Math.max(0, col * cellWidth + offsetX),
        blend: "over",
      });
    }
  }

  return composites;
}

function buildTextOverlaySvg(params: {
  width: number;
  height: number;
  opacity: number;
  density: WatermarkDensity;
  centerBias: boolean;
  centerText?: string;
}): Buffer {
  const minSide = Math.min(params.width, params.height);
  const fontSize =
    params.density === "very_high"
      ? Math.max(14, Math.floor(minSide / 22))
      : params.density === "high"
        ? Math.max(13, Math.floor(minSide / 24))
        : Math.max(12, Math.floor(minSide / 28));
  const scaledFontSize = Math.max(10, Math.floor(fontSize * 0.85));
  const textOpacity = Math.min(0.85, Math.max(0.28, params.opacity + (params.density === "very_high" ? 0.12 : 0)));

  return buildTiledWatermarkSvg({
    width: params.width,
    height: params.height,
    text: WATERMARK_TILED_TEXT,
    opacity: textOpacity,
    fontSize: scaledFontSize,
    rotations: [0, -28, 28, -56, 56],
    quantityFactor: DYNAMIC_WATERMARK_QUANTITY_FACTOR,
    centerText: params.centerBias || params.centerText
      ? (params.centerText ?? DEFAULT_CENTER_WATERMARK_TEXT)
      : undefined,
    blurStdDev: 0,
    blurDx: 0,
    blurDy: 0,
  });
}

async function applyFineGrainNoise(
  buffer: Buffer,
  width: number,
  height: number,
  config: PublicPhotoVariantConfig
): Promise<Buffer> {
  if (!config.enableFineNoise || width < 8 || height < 8) {
    return buffer;
  }
  try {
    const pixels = width * height;
    const raw = Buffer.alloc(pixels);
    for (let i = 0; i < pixels; i++) {
      raw[i] = Math.floor(Math.random() * config.fineNoiseStrength);
    }
    const noiseOverlay = await sharp(raw, { raw: { width, height, channels: 1 } })
      .blur(0.5)
      .linear([1, 1, 1, 0.28], [0, 0, 0, 0])
      .png()
      .toBuffer();

    return await sharp(buffer).composite([{ input: noiseOverlay, blend: "overlay" }]).toBuffer();
  } catch (err) {
    console.warn("[watermark-render] fine_noise_skipped", { width, height, err });
    return buffer;
  }
}

/** Prepara tono sin desaturar ni pasar por JPEG intermedio (evita look apagado). */
async function prepareVariantBase(
  buffer: Buffer,
  config: PublicPhotoVariantConfig
): Promise<Buffer> {
  const normalized = await sharp(buffer).rotate().toBuffer();
  const meta = await sharp(normalized).metadata();
  const width = meta.width ?? 1;
  const height = meta.height ?? 1;
  return applyFineGrainNoise(normalized, width, height, config);
}

function jpegOptionsForPublicMode(mode: PublicWatermarkMode, config: PublicPhotoVariantConfig) {
  const quality = mode === "thumb" ? config.thumbQuality : config.previewQuality;
  return {
    quality,
    chromaSubsampling: "4:2:0" as const,
    mozjpeg: true,
    progressive: mode === "preview",
  };
}

/**
 * Renderiza JPEG público con marca. Calidad moderada: fiel al original, sin entregar alta resolución.
 */
export async function renderPublicWatermarkedJpeg(
  sourceBuffer: Buffer,
  mode: PublicWatermarkMode,
  config: PublicPhotoVariantConfig = getPublicPhotoVariantConfig(),
  options?: { centerText?: string }
): Promise<Buffer> {
  const maxSide = mode === "thumb" ? config.thumbMaxSide : config.previewMaxSide;
  const resizedBuffer = await sharp(sourceBuffer)
    .rotate()
    .resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
    .toBuffer();

  const meta = await sharp(resizedBuffer).metadata();
  const width = meta.width || maxSide;
  const height = meta.height || maxSide;

  const prepared = await prepareVariantBase(resizedBuffer, config);

  const pngComposites = await buildLogoGridComposites({
    imageWidth: width,
    imageHeight: height,
    pngOpacity: Math.min(1, config.watermarkOpacity + 0.15),
    density: config.watermarkDensity,
  });

  const textOverlay = buildTextOverlaySvg({
    width,
    height,
    opacity: config.watermarkOpacity,
    density: config.watermarkDensity,
    centerBias: config.watermarkCenterBias,
    centerText: options?.centerText,
  });

  const overlayComposites = [
    ...pngComposites,
    { input: textOverlay, blend: "over" as sharp.Blend },
  ];

  try {
    return await sharp(prepared)
      .composite(overlayComposites)
      .jpeg(jpegOptionsForPublicMode(mode, config))
      .toBuffer();
  } catch (err) {
    console.warn("[watermark-render] public_composite_failed", { mode, err });
    return sharp(prepared)
      .jpeg(jpegOptionsForPublicMode(mode, config))
      .toBuffer();
  }
}

/** Pipeline legacy (view dinámico bought / compatibilidad). */
export async function applyClassicPreviewWatermark(
  resized: sharp.Sharp,
  params: {
    width: number;
    height: number;
    mode: ClassicWatermarkMode;
    applyBoughtWatermark: boolean;
  }
): Promise<Buffer> {
  const { width, height, mode, applyBoughtWatermark } = params;
  if (mode === "bought" && !applyBoughtWatermark) {
    return resized.jpeg({ quality: 90 }).toBuffer();
  }

  const fontSize =
    mode === "bought"
      ? Math.max(20, Math.floor(Math.min(width, height) / 24))
      : Math.max(22, Math.floor(Math.min(width, height) / 18));
  const textOpacity = mode === "thumb" || mode === "preview" ? LEGACY_TEXT_OPACITY : 0.5;
  const scaledFontSize = Math.max(12, Math.floor(fontSize * 0.75));
  const overlay = buildTiledWatermarkSvg({
    width,
    height,
    text: WATERMARK_TILED_TEXT,
    opacity: textOpacity,
    fontSize: scaledFontSize,
    rotations: [0, -30, 30, -60],
    quantityFactor: DYNAMIC_WATERMARK_QUANTITY_FACTOR,
    centerText: "compramelafoto.com",
    blurStdDev: Math.max(0.1, scaledFontSize * 0.05),
    blurDx: Math.max(0.1, scaledFontSize * 0.05),
    blurDy: 0,
  });

  const watermarkBuffer = await loadWatermarkPng();
  const pngComposites: Array<{ input: Buffer; top: number; left: number; blend?: sharp.Blend }> = [];
  if (watermarkBuffer) {
    const watermarkMetadata = await sharp(watermarkBuffer).metadata();
    if (watermarkMetadata.width && watermarkMetadata.height) {
      const cellWidth = Math.floor(width / 3);
      const cellHeight = Math.floor(height / 3);
      const maxWatermarkWidth = Math.max(
        1,
        Math.min(Math.floor(width * LEGACY_WATERMARK_SCALE), cellWidth - 2, width - 2)
      );
      const watermarkWidth = maxWatermarkWidth;
      const watermarkHeight = Math.min(
        Math.floor((watermarkMetadata.height * watermarkWidth) / watermarkMetadata.width),
        cellHeight - 2
      );
      if (watermarkWidth > 1 && watermarkHeight > 1) {
        const logoTile = await buildWatermarkLogoTile({
          watermarkBuffer,
          watermarkWidth,
          watermarkHeight,
          pngOpacity: LEGACY_PNG_OPACITY,
        });
        const offsetX = Math.max(0, Math.floor((cellWidth - watermarkWidth) / 2));
        const offsetY = Math.max(0, Math.floor((cellHeight - watermarkHeight) / 2));
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            pngComposites.push({
              input: logoTile,
              top: Math.max(0, row * cellHeight + offsetY),
              left: Math.max(0, col * cellWidth + offsetX),
              blend: "over",
            });
          }
        }
      }
    }
  }

  const jpegQuality = mode === "thumb" ? 38 : 50;
  const baseBuffer = await resized.toBuffer();
  try {
    return await sharp(baseBuffer)
      .composite([...pngComposites, { input: overlay, blend: "over" }])
      .jpeg({ quality: jpegQuality, ...(mode === "thumb" ? { mozjpeg: true } : {}) })
      .toBuffer();
  } catch {
    return sharp(baseBuffer)
      .jpeg({ quality: jpegQuality, ...(mode === "thumb" ? { mozjpeg: true } : {}) })
      .toBuffer();
  }
}
