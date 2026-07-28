import sharp from "sharp";
import type { CropBox, CropParams } from "./types";

/**
 * Recorte automático:
 * 1) FACE — si hay boundingBox de detector externo
 * 2) ATTENTION — Sharp strategy (regiones salientes / rostro aproximado)
 * 3) CENTER — fallback
 *
 * No destruye el original: solo calcula params + buffer derivado.
 */
export async function resolveCropParams(
  source: Buffer,
  preferred?: Partial<CropParams> | null,
): Promise<CropParams> {
  if (preferred?.strategy === "MANUAL" && preferred.boundingBox) {
    return {
      cropX: preferred.cropX ?? preferred.boundingBox.x,
      cropY: preferred.cropY ?? preferred.boundingBox.y,
      zoom: preferred.zoom ?? 1,
      rotation: preferred.rotation ?? 0,
      boundingBox: preferred.boundingBox,
      strategy: "MANUAL",
    };
  }

  if (preferred?.boundingBox && preferred.strategy === "FACE") {
    return {
      cropX: preferred.boundingBox.x,
      cropY: preferred.boundingBox.y,
      zoom: preferred.zoom ?? 1,
      rotation: preferred.rotation ?? 0,
      boundingBox: preferred.boundingBox,
      strategy: "FACE",
    };
  }

  const meta = await sharp(source).rotate().metadata();
  const w = meta.width ?? 1;
  const h = meta.height ?? 1;
  const side = Math.min(w, h);
  const box: CropBox = {
    x: (w - side) / 2 / w,
    y: (h - side) / 2 / h,
    width: side / w,
    height: side / h,
  };

  // Intento attention: si Sharp puede generar un extract usable, marcamos ATTENTION.
  try {
    await sharp(source)
      .rotate()
      .resize(64, 64, { fit: "cover", position: "attention" })
      .toBuffer();
    return {
      cropX: box.x,
      cropY: box.y,
      zoom: 1,
      rotation: 0,
      boundingBox: box,
      strategy: "ATTENTION",
    };
  } catch {
    return {
      cropX: box.x,
      cropY: box.y,
      zoom: 1,
      rotation: 0,
      boundingBox: box,
      strategy: "CENTER",
    };
  }
}

export async function extractSquareCrop(
  source: Buffer,
  crop: CropParams,
  size: number,
): Promise<Buffer> {
  const rotated = sharp(source).rotate(crop.rotation || undefined);
  const meta = await rotated.metadata();
  const w = meta.width ?? size;
  const h = meta.height ?? size;

  if (crop.strategy === "ATTENTION" && !crop.boundingBox) {
    return sharp(source)
      .rotate()
      .resize(size, size, { fit: "cover", position: "attention" })
      .toBuffer();
  }

  const box = crop.boundingBox ?? {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  };
  const left = Math.max(0, Math.floor(box.x * w));
  const top = Math.max(0, Math.floor(box.y * h));
  const width = Math.max(1, Math.min(w - left, Math.floor(box.width * w)));
  const height = Math.max(1, Math.min(h - top, Math.floor(box.height * h)));
  const side = Math.min(width, height);
  const zoom = Math.max(1, crop.zoom || 1);
  const zoomed = Math.max(1, Math.floor(side / zoom));
  const cx = left + Math.floor(width / 2);
  const cy = top + Math.floor(height / 2);
  const extractLeft = Math.max(0, Math.min(w - zoomed, cx - Math.floor(zoomed / 2)));
  const extractTop = Math.max(0, Math.min(h - zoomed, cy - Math.floor(zoomed / 2)));

  return sharp(source)
    .rotate(crop.rotation || undefined)
    .extract({ left: extractLeft, top: extractTop, width: zoomed, height: zoomed })
    .resize(size, size, { fit: "cover" })
    .toBuffer();
}

export const DEFAULT_PROFILE_PHOTO_LIMITS = {
  maxBytes: 8 * 1024 * 1024,
  minWidth: 400,
  minHeight: 400,
  allowedMime: ["image/jpeg", "image/png", "image/webp"] as const,
};

export async function validateProfilePhotoBuffer(
  buffer: Buffer,
  mime: string,
  limits = DEFAULT_PROFILE_PHOTO_LIMITS,
): Promise<{ width: number; height: number }> {
  if (!limits.allowedMime.includes(mime as (typeof limits.allowedMime)[number])) {
    throw new Error("PHOTO_FORMAT_INVALID");
  }
  if (buffer.byteLength > limits.maxBytes) {
    throw new Error("PHOTO_TOO_LARGE");
  }
  const meta = await sharp(buffer).rotate().metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < limits.minWidth || height < limits.minHeight) {
    throw new Error("PHOTO_TOO_SMALL");
  }
  const format = meta.format;
  if (format !== "jpeg" && format !== "png" && format !== "webp") {
    throw new Error("PHOTO_FORMAT_INVALID");
  }
  return { width, height };
}

export async function buildProfilePhotoDerivatives(
  source: Buffer,
  crop?: CropParams | null,
): Promise<{
  original: Buffer;
  thumbnail: Buffer;
  square: Buffer;
  storyCrop: Buffer;
  crop: CropParams;
}> {
  const resolved = await resolveCropParams(source, crop);
  const original = await sharp(source).rotate().withMetadata().toBuffer();
  const square = await extractSquareCrop(source, resolved, 1080);
  const thumbnail = await sharp(square).resize(256, 256).webp({ quality: 80 }).toBuffer();
  const storyCrop = await extractSquareCrop(source, resolved, 900);
  return { original, thumbnail, square, storyCrop, crop: resolved };
}
