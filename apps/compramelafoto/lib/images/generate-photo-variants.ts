import { prisma } from "@/lib/prisma";
import { uploadToR2 } from "@/lib/r2-client";
import {
  getPublicPhotoVariantConfig,
  isGenerateVariantsOnUploadEnabled,
  previewVariantR2Key,
  thumbVariantR2Key,
  type PublicPhotoVariantConfig,
} from "@/lib/images/photo-variant-config";
import {
  loadVariantGenerationSourceBuffer,
  PhotoVariantSourceError,
  type VariantSourceDiagnostic,
} from "@/lib/images/photo-variant-source";
import { renderPublicWatermarkedJpeg } from "@/lib/images/watermark-render";
import { loadCenterWatermarkTextForPhoto } from "@/lib/images/watermark-photographer-center";

export type VariantGenerationLog = {
  photoId: number;
  albumId: number;
  variantsVersion: string;
  thumbBytes: number;
  previewBytes: number;
  thumbMaxSide: number;
  previewMaxSide: number;
  thumbQuality: number;
  previewQuality: number;
  generationMs: number;
  createdAt: string;
  generated: ("thumb_wm" | "preview_wm")[];
  status: "ok" | "error";
  errorMessage?: string;
  sourceDiagnostic?: VariantSourceDiagnostic;
};

function observabilityFromConfig(config: PublicPhotoVariantConfig) {
  return {
    variantsVersion: config.fileVersion,
    thumbMaxSide: config.thumbMaxSide,
    previewMaxSide: config.previewMaxSide,
    thumbQuality: config.thumbQuality,
    previewQuality: config.previewQuality,
  };
}

function formatPersistError(err: unknown, diagnostic?: VariantSourceDiagnostic): string {
  if (err instanceof PhotoVariantSourceError) {
    return JSON.stringify({ message: err.message, ...err.diagnostic }).slice(0, 2000);
  }
  if (diagnostic) {
    return JSON.stringify({ message: err instanceof Error ? err.message : String(err), ...diagnostic }).slice(
      0,
      2000
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  return message.slice(0, 2000);
}

export async function generateAndUploadPhotoVariants(params: {
  photoId: number;
  albumId: number;
  previewUrl?: string | null;
  originalKey: string;
  centerText?: string;
}): Promise<{
  thumbWatermarkedKey: string;
  previewWatermarkedKey: string;
  variantsVersion: string;
  thumbBytes: number;
  previewBytes: number;
  thumbMaxSide: number;
  previewMaxSide: number;
  thumbQuality: number;
  previewQuality: number;
  sourceDiagnostic: VariantSourceDiagnostic;
}> {
  const config = getPublicPhotoVariantConfig();
  const { buffer: sourceBuffer, diagnostic } = await loadVariantGenerationSourceBuffer({
    photoId: params.photoId,
    albumId: params.albumId,
    previewUrl: params.previewUrl,
    originalKey: params.originalKey,
  });

  const renderOptions = params.centerText ? { centerText: params.centerText } : undefined;

  let thumbBuffer: Buffer;
  let previewBuffer: Buffer;
  try {
    thumbBuffer = await renderPublicWatermarkedJpeg(sourceBuffer, "thumb", config, renderOptions);
  } catch (err) {
    throw new Error(
      `thumb render failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  try {
    previewBuffer = await renderPublicWatermarkedJpeg(sourceBuffer, "preview", config, renderOptions);
  } catch (err) {
    throw new Error(
      `preview render failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const thumbKey = thumbVariantR2Key(params.photoId, config.fileVersion);
  const previewKey = previewVariantR2Key(params.photoId, config.fileVersion);

  await Promise.all([
    uploadToR2(thumbBuffer, thumbKey, "image/jpeg", {
      type: "photo_variant_thumb",
      photoId: String(params.photoId),
      albumId: String(params.albumId),
      variantVersion: config.fileVersion,
    }),
    uploadToR2(previewBuffer, previewKey, "image/jpeg", {
      type: "photo_variant_preview",
      photoId: String(params.photoId),
      albumId: String(params.albumId),
      variantVersion: config.fileVersion,
    }),
  ]);

  return {
    thumbWatermarkedKey: thumbKey,
    previewWatermarkedKey: previewKey,
    variantsVersion: config.fileVersion,
    thumbBytes: thumbBuffer.length,
    previewBytes: previewBuffer.length,
    thumbMaxSide: config.thumbMaxSide,
    previewMaxSide: config.previewMaxSide,
    thumbQuality: config.thumbQuality,
    previewQuality: config.previewQuality,
    sourceDiagnostic: diagnostic,
  };
}

export async function persistPhotoVariantsReady(params: {
  photoId: number;
  thumbWatermarkedKey: string;
  previewWatermarkedKey: string;
  variantsVersion: string;
}): Promise<void> {
  await prisma.photo.update({
    where: { id: params.photoId },
    data: {
      thumbWatermarkedKey: params.thumbWatermarkedKey,
      previewWatermarkedKey: params.previewWatermarkedKey,
      variantsVersion: params.variantsVersion,
      variantsGeneratedAt: new Date(),
      variantsStatus: "READY",
      variantsError: null,
    },
  });
}

export async function persistPhotoVariantsFailed(photoId: number, error: unknown): Promise<void> {
  const diagnostic =
    error instanceof PhotoVariantSourceError ? error.diagnostic : undefined;
  const message = formatPersistError(error, diagnostic);
  await prisma.photo.update({
    where: { id: photoId },
    data: {
      variantsStatus: "FAILED",
      variantsError: message,
    },
  });
}

export async function markPhotoVariantsProcessing(photoId: number): Promise<void> {
  await prisma.photo.update({
    where: { id: photoId },
    data: { variantsStatus: "PROCESSING", variantsError: null },
  });
}

/**
 * Genera variantes desde preview/original en R2, sube y actualiza Photo.
 * No modifica originalKey ni previewUrl en DB.
 */
export async function generatePersistPhotoVariants(params: {
  photoId: number;
  albumId: number;
  previewUrl?: string | null;
  originalKey: string;
  createdAt?: Date;
}): Promise<VariantGenerationLog> {
  const started = Date.now();
  const config = getPublicPhotoVariantConfig();
  const obs = observabilityFromConfig(config);
  const logBase = {
    photoId: params.photoId,
    albumId: params.albumId,
    createdAt: (params.createdAt ?? new Date()).toISOString(),
    generated: [] as ("thumb_wm" | "preview_wm")[],
    ...obs,
    thumbBytes: 0,
    previewBytes: 0,
    generationMs: 0,
  };

  try {
    await markPhotoVariantsProcessing(params.photoId);
    const centerText = await loadCenterWatermarkTextForPhoto(prisma, {
      photoId: params.photoId,
      albumId: params.albumId,
    });
    const result = await generateAndUploadPhotoVariants({
      photoId: params.photoId,
      albumId: params.albumId,
      previewUrl: params.previewUrl,
      originalKey: params.originalKey,
      centerText,
    });
    await persistPhotoVariantsReady({
      photoId: params.photoId,
      thumbWatermarkedKey: result.thumbWatermarkedKey,
      previewWatermarkedKey: result.previewWatermarkedKey,
      variantsVersion: result.variantsVersion,
    });
    const generationMs = Date.now() - started;
    const log: VariantGenerationLog = {
      ...logBase,
      variantsVersion: result.variantsVersion,
      thumbBytes: result.thumbBytes,
      previewBytes: result.previewBytes,
      thumbMaxSide: result.thumbMaxSide,
      previewMaxSide: result.previewMaxSide,
      thumbQuality: result.thumbQuality,
      previewQuality: result.previewQuality,
      generationMs,
      generated: ["thumb_wm", "preview_wm"],
      status: "ok",
      sourceDiagnostic: result.sourceDiagnostic,
    };
    console.info("[photo-variant] generated", JSON.stringify(log));
    return log;
  } catch (err) {
    const sourceDiagnostic =
      err instanceof PhotoVariantSourceError ? err.diagnostic : undefined;
    await persistPhotoVariantsFailed(params.photoId, err);
    const log: VariantGenerationLog = {
      ...logBase,
      generationMs: Date.now() - started,
      generated: [],
      status: "error",
      errorMessage: err instanceof Error ? err.message : String(err),
      sourceDiagnostic,
    };
    console.warn("[photo-variant] generation_failed", JSON.stringify(log));
    return log;
  }
}

/** Generación en background tras upload (no bloquea la respuesta HTTP). */
export function schedulePhotoVariantsOnUpload(photo: {
  id: number;
  albumId: number;
  previewUrl?: string | null;
  originalKey: string;
  createdAt?: Date;
}): void {
  if (!isGenerateVariantsOnUploadEnabled()) return;
  void generatePersistPhotoVariants({
    photoId: photo.id,
    albumId: photo.albumId,
    previewUrl: photo.previewUrl,
    originalKey: photo.originalKey,
    createdAt: photo.createdAt,
  }).catch((err) => {
    console.error("[photo-variant] upload_unhandled", { photoId: photo.id, err });
  });
}
