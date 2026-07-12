/**
 * Pipeline de derivados editoriales CLF → Info Spot.
 * Nunca entrega ni reexpone el original comercial.
 */

import sharp from "sharp";
import { prisma } from "@repo/db";
import { isR2Configured, uploadToR2 } from "../r2-client";
import { getPublicUrl } from "../r2-public-url";
import { readR2ObjectBuffer } from "../r2-read";

export const EDITORIAL_VARIANT_WIDTHS = [640, 960, 1280, 1920] as const;
export type EditorialVariantWidth = (typeof EDITORIAL_VARIANT_WIDTHS)[number];

const WEBP_QUALITY = 82;
const JPEG_QUALITY = 84;

export function editorialClfNamespace(sourcePhotoId: string | number): string {
  return `infospot/editorial/clf/${sourcePhotoId}`;
}

export function stripSensitiveMetadata() {
  // sharp().rotate() + toBuffer sin withMetadata → EXIF eliminado.
  return true;
}

export async function buildResponsiveVariants(input: {
  sourceBuffer: Buffer;
  sourcePhotoId: string;
}): Promise<
  Array<{ width: number; format: "webp" | "jpeg"; r2Key: string; url: string; bytes: number }>
> {
  if (!isR2Configured()) {
    throw new Error("R2 no configurado");
  }

  const base = sharp(input.sourceBuffer).rotate();
  const meta = await base.metadata();
  const sourceWidth = meta.width ?? 1920;
  const results: Array<{
    width: number;
    format: "webp" | "jpeg";
    r2Key: string;
    url: string;
    bytes: number;
  }> = [];

  for (const width of EDITORIAL_VARIANT_WIDTHS) {
    if (width > sourceWidth + 32 && width !== 640) {
      // No ampliar artificialmente salvo thumb mínimo.
      continue;
    }
    const target = Math.min(width, sourceWidth);
    const pipeline = sharp(input.sourceBuffer).rotate().resize({
      width: target,
      height: target,
      fit: "inside",
      withoutEnlargement: true,
    });

    const webpBuf = await pipeline.clone().webp({ quality: WEBP_QUALITY }).toBuffer();
    const webpKey = `${editorialClfNamespace(input.sourcePhotoId)}/w${target}.webp`;
    const webpUp = await uploadToR2(webpBuf, webpKey, "image/webp", {
      type: "infospot_editorial_variant",
      photoId: String(input.sourcePhotoId),
      width: String(target),
    });
    results.push({
      width: target,
      format: "webp",
      r2Key: webpUp.key,
      url: webpUp.url,
      bytes: webpBuf.byteLength,
    });

    // JPEG fallback solo para el master (max) y 960.
    if (target === Math.min(1920, sourceWidth) || target === 960 || target === 640) {
      const jpegBuf = await pipeline.clone().jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
      const jpegKey = `${editorialClfNamespace(input.sourcePhotoId)}/w${target}.jpg`;
      const jpegUp = await uploadToR2(jpegBuf, jpegKey, "image/jpeg", {
        type: "infospot_editorial_variant_jpeg",
        photoId: String(input.sourcePhotoId),
        width: String(target),
      });
      results.push({
        width: target,
        format: "jpeg",
        r2Key: jpegUp.key,
        url: jpegUp.url,
        bytes: jpegBuf.byteLength,
      });
    }
  }

  stripSensitiveMetadata();
  return results;
}

export { getEditorialPhotoDelivery } from "./delivery";

/**
 * Procesa derivados para una InfoSpotEditorialPhoto existente.
 * Idempotente: no duplica variantes (unique photoId+width+format).
 */
export async function processEditorialDerivative(photoId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const photo = await prisma.infoSpotEditorialPhoto.findUnique({
    where: { id: photoId },
    include: { variants: true },
  });
  if (!photo) return { ok: false, error: "Foto editorial no encontrada" };
  if (!photo.sourceStorageKey) {
    await prisma.infoSpotEditorialPhoto.update({
      where: { id: photoId },
      data: {
        processStatus: "FAILED",
        processError: "Sin sourceStorageKey (no se puede derivar).",
      },
    });
    return { ok: false, error: "Sin sourceStorageKey" };
  }

  await prisma.infoSpotEditorialPhoto.update({
    where: { id: photoId },
    data: { processStatus: "PROCESSING", processError: null },
  });

  try {
    const sourceBuffer = await readR2ObjectBuffer(photo.sourceStorageKey);
    const variants = await buildResponsiveVariants({
      sourceBuffer,
      sourcePhotoId: photo.sourcePhotoExternalId,
    });

    for (const v of variants) {
      await prisma.infoSpotEditorialPhotoVariant.upsert({
        where: {
          photoId_width_format: {
            photoId,
            width: v.width,
            format: v.format,
          },
        },
        create: {
          photoId,
          width: v.width,
          format: v.format,
          r2Key: v.r2Key,
          url: v.url,
          bytes: v.bytes,
        },
        update: {
          r2Key: v.r2Key,
          url: v.url,
          bytes: v.bytes,
        },
      });
    }

    const master =
      variants.find((v) => v.format === "webp" && v.width >= 1280) ||
      variants.find((v) => v.format === "webp") ||
      variants[0];
    const thumb =
      variants.find((v) => v.format === "webp" && v.width === 640) ||
      variants.find((v) => v.width === 640) ||
      master;

    // Compat: delivery asset legacy
    let deliveryAssetId = photo.deliveryAssetId;
    const sourcePhotoId = Number(photo.sourcePhotoExternalId);
    if (Number.isFinite(sourcePhotoId) && master) {
      const existing = await prisma.infoSpotEditorialAsset.findFirst({
        where: { sourceType: "CLF_PHOTO", sourcePhotoId },
      });
      if (existing) {
        deliveryAssetId = existing.id;
        await prisma.infoSpotEditorialAsset.update({
          where: { id: existing.id },
          data: {
            r2Key: master.r2Key,
            url: master.url,
            thumbnailUrl: thumb?.url ?? master.url,
            photographerName: photo.photographerName,
            photographerId: photo.photographerUserId,
            credit: photo.credit,
            copyrightText: photo.copyrightText,
            isPermanentEditorialAsset: true,
          },
        });
      } else {
        const created = await prisma.infoSpotEditorialAsset.create({
          data: {
            sourceType: "CLF_PHOTO",
            sourcePhotoId,
            sourceAlbumId: Number(photo.sourceAlbumExternalId) || null,
            r2Key: master.r2Key,
            url: master.url,
            thumbnailUrl: thumb?.url ?? master.url,
            photographerName: photo.photographerName,
            photographerId: photo.photographerUserId,
            credit: photo.credit,
            copyrightText: photo.copyrightText,
            isPermanentEditorialAsset: true,
            importedAt: new Date(),
          },
        });
        deliveryAssetId = created.id;
      }
    }

    await prisma.infoSpotEditorialPhoto.update({
      where: { id: photoId },
      data: {
        processStatus: "READY",
        processError: null,
        editorialMasterKey: master?.r2Key ?? null,
        deliveryAssetId,
        lastSyncedAt: new Date(),
      },
    });

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error de procesamiento";
    await prisma.infoSpotEditorialPhoto.update({
      where: { id: photoId },
      data: { processStatus: "FAILED", processError: message },
    });
    return { ok: false, error: message };
  }
}

export async function requestEditorialDerivative(photoId: string) {
  await prisma.infoSpotEditorialPhoto.update({
    where: { id: photoId },
    data: { processStatus: "PENDING", processError: null },
  });
  return processEditorialDerivative(photoId);
}

/** Helper de URL pública sin filtrar keys privadas al cliente. */
export function publicUrlForKey(key: string): string {
  return getPublicUrl(key);
}
