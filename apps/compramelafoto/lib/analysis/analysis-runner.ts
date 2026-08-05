import { NextResponse } from "next/server";
import type { AlbumCleanupStatus, PhotoExifMetadataStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getR2ObjectMetadata, readFromR2 } from "@/lib/r2-client";
import { extractOcrTokensFromImage } from "@/lib/ocr/extract-ocr-tokens";
import { indexFaces, searchFacesByImage } from "@/lib/faces/rekognition";
import { processPhotoExifFromBuffer } from "@/lib/photographic-equipment/process-photo-exif";
import {
  ANALYSIS_SUSPENDED_BY_AGE_PREFIX,
  photoCreatedAtCutoff,
  resolveMaxPhotoAgeDays,
} from "@/lib/analysis/analysis-age-policy";
import sharp from "sharp";

const DEFAULT_BATCH_SIZE = 2;
const DEFAULT_CONCURRENCY = 2;
const MAX_ATTEMPTS = 3;

type RunOptions = {
  includeOcr: boolean;
  debug: boolean;
  source: "cron" | "admin";
  /** Si se indica, solo crea/claim jobs de ese álbum (útil para destrabar galerías grandes). */
  albumId?: number;
};

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolveBatchSize() {
  const envValue = Number(process.env.ANALYSIS_BATCH_SIZE ?? DEFAULT_BATCH_SIZE);
  return clampInt(Number.isFinite(envValue) ? envValue : DEFAULT_BATCH_SIZE, 1, 20);
}

function resolveConcurrency() {
  const envValue = Number(process.env.ANALYSIS_CONCURRENCY ?? DEFAULT_CONCURRENCY);
  return clampInt(Number.isFinite(envValue) ? envValue : DEFAULT_CONCURRENCY, 1, 6);
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function runNext(): Promise<void> {
    if (index >= items.length) return;
    const current = items[index++];
    const result = await worker(current);
    results.push(result);
    await runNext();
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

async function claimJobsAtomic(
  now: Date,
  batchSize: number,
  albumId?: number,
  maxPhotoAgeDays?: number | null
) {
  const scopedAlbum =
    typeof albumId === "number" && Number.isFinite(albumId) ? albumId : undefined;
  // Con albumId (reproceso manual) no aplicamos tope de antigüedad.
  const ageCutoff =
    scopedAlbum == null && typeof maxPhotoAgeDays === "number"
      ? photoCreatedAtCutoff(maxPhotoAgeDays, now)
      : null;

  const candidates = await prisma.photoAnalysisJob.findMany({
    where: {
      status: "PENDING",
      OR: [{ runAfter: null }, { runAfter: { lte: now } }],
      photo: {
        isRemoved: false,
        ...(scopedAlbum != null ? { albumId: scopedAlbum } : {}),
        ...(ageCutoff ? { createdAt: { gte: ageCutoff } } : {}),
      },
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    select: { id: true },
  });

  // Usamos FOR UPDATE SKIP LOCKED para evitar doble toma entre workers concurrentes.
  const locked =
    scopedAlbum != null
      ? await prisma.$queryRaw<Array<{ id: number; photoId: number }>>`
          WITH claimed AS (
            SELECT j.id
            FROM "PhotoAnalysisJob" j
            INNER JOIN "Photo" p ON p.id = j."photoId"
            WHERE j.status = 'PENDING'
              AND (j."runAfter" IS NULL OR j."runAfter" <= ${now})
              AND p."albumId" = ${scopedAlbum}
              AND p."isRemoved" = false
            ORDER BY j."createdAt" ASC
            LIMIT ${batchSize}
            FOR UPDATE OF j SKIP LOCKED
          )
          UPDATE "PhotoAnalysisJob"
          SET status = 'PROCESSING', "lockedAt" = ${now}
          WHERE id IN (SELECT id FROM claimed)
          RETURNING id, "photoId"
        `
      : ageCutoff
        ? await prisma.$queryRaw<Array<{ id: number; photoId: number }>>`
            WITH claimed AS (
              SELECT j.id
              FROM "PhotoAnalysisJob" j
              INNER JOIN "Photo" p ON p.id = j."photoId"
              WHERE j.status = 'PENDING'
                AND (j."runAfter" IS NULL OR j."runAfter" <= ${now})
                AND p."isRemoved" = false
                AND p."createdAt" >= ${ageCutoff}
              ORDER BY j."createdAt" ASC
              LIMIT ${batchSize}
              FOR UPDATE OF j SKIP LOCKED
            )
            UPDATE "PhotoAnalysisJob"
            SET status = 'PROCESSING', "lockedAt" = ${now}
            WHERE id IN (SELECT id FROM claimed)
            RETURNING id, "photoId"
          `
        : await prisma.$queryRaw<Array<{ id: number; photoId: number }>>`
            WITH claimed AS (
              SELECT id
              FROM "PhotoAnalysisJob"
              WHERE status = 'PENDING'
                AND ("runAfter" IS NULL OR "runAfter" <= ${now})
              ORDER BY "createdAt" ASC
              LIMIT ${batchSize}
              FOR UPDATE SKIP LOCKED
            )
            UPDATE "PhotoAnalysisJob"
            SET status = 'PROCESSING', "lockedAt" = ${now}
            WHERE id IN (SELECT id FROM claimed)
            RETURNING id, "photoId"
          `;

  return { jobsFound: candidates.length, locked };
}

async function matchFacesWithInterested(
  photoId: number,
  albumId: number,
  imageBuffer: Buffer
): Promise<void> {
  const now = new Date();
  const interestedWithFaces = await prisma.albumInterest.findMany({
    where: {
      albumId,
      faceId: { not: null },
      biometricDeletedAt: null,
      expiresAt: { gt: now },
      biometricConsent: true,
    },
    select: {
      id: true,
      faceId: true,
      email: true,
    },
  });

  if (interestedWithFaces.length === 0) return;

  const faceMatches = await searchFacesByImage(new Uint8Array(imageBuffer));
  if (faceMatches.length === 0) return;

  const faceIdToInterest = new Map<string, typeof interestedWithFaces[0]>();
  for (const interest of interestedWithFaces) {
    if (interest.faceId) {
      faceIdToInterest.set(interest.faceId, interest);
    }
  }

  const faceDetections = await prisma.faceDetection.findMany({
    where: { photoId },
    select: { id: true, rekognitionFaceId: true },
  });
  const rekognitionFaceIdToDetection = new Map(
    faceDetections.map((fd) => [fd.rekognitionFaceId, fd.id])
  );

  const matchesToCreate: Array<{
    albumInterestId: number;
    photoId: number;
    faceDetectionId: number | null;
    similarity: number;
  }> = [];

  for (const match of faceMatches) {
    const interest = faceIdToInterest.get(match.rekognitionFaceId);
    if (interest && match.similarity && match.similarity >= 70) {
      const faceDetectionId = rekognitionFaceIdToDetection.get(match.rekognitionFaceId) || null;
      matchesToCreate.push({
        albumInterestId: interest.id,
        photoId,
        faceDetectionId,
        similarity: match.similarity,
      });
    }
  }

  if (matchesToCreate.length === 0) return;

  const existingMatches = await prisma.faceMatchEvent.findMany({
    where: {
      photoId,
      albumInterestId: { in: matchesToCreate.map((m) => m.albumInterestId) },
    },
    select: { albumInterestId: true },
  });
  const existingInterestIds = new Set(existingMatches.map((em) => em.albumInterestId));
  const newMatches = matchesToCreate.filter((m) => !existingInterestIds.has(m.albumInterestId));

  if (newMatches.length === 0) return;

  await prisma.faceMatchEvent.createMany({
    data: newMatches.map((m) => ({
      albumInterestId: m.albumInterestId,
      photoId: m.photoId,
      faceDetectionId: m.faceDetectionId,
      similarity: m.similarity,
      notifiedAt: null,
    })),
  });

  const notifyUrl = `${process.env.APP_URL || "http://localhost:3000"}/api/internal/face-matching/notify`;
  const cronSecret = process.env.CRON_SECRET;
  fetch(notifyUrl, {
    method: "GET",
    headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
  }).catch((fetchErr) => {
    console.warn("[analysis_v2] notify_failed", fetchErr);
  });
}

type AnalysisPhotoContext = {
  id: number;
  albumId: number;
  userId: number | null;
  originalKey: string | null;
  previewUrl: string | null;
  createdAt: Date;
  capturedAt: Date | null;
  storageDeletedAt: Date | null;
  exifMetadataStatus: PhotoExifMetadataStatus | null;
  album: {
    userId: number;
    deletedAt: Date | null;
    isHidden: boolean;
    firstPhotoDate: Date | null;
    expirationExtensionDays: number | null;
    cleanupStatus: AlbumCleanupStatus;
  };
};

async function processJob(
  job: {
    id: number;
    photoId: number;
    attempts: number | null;
    photo: AnalysisPhotoContext | null;
  },
  includeOcr: boolean,
  debug: boolean
) {
  const photo = job.photo;
  const photoId = job.photoId;
  const tStart = Date.now();
  const timing: Record<string, number> = {};
  const debugChecks: Array<Record<string, unknown>> = [];
  let jobCompleted = false;

  try {
    if (!photo?.originalKey) {
      await prisma.photoAnalysisJob.update({
        where: { id: job.id },
        data: {
          status: "ERROR",
          lastError: "Foto sin originalKey",
          lockedAt: null,
        },
      });
      await prisma.photo.update({
        where: { id: photoId },
        data: { analysisStatus: "ERROR", analysisError: "Foto sin originalKey" },
      });
      jobCompleted = true;
      return { ok: false, photoId, error: "Foto sin originalKey" };
    }

    await prisma.photo.update({
      where: { id: photo.id },
      data: { analysisStatus: "PROCESSING", analysisError: null },
    });

    const tR2 = Date.now();
    const r2Metadata = await getR2ObjectMetadata(photo.originalKey).catch(() => null);
    let imageBuffer: Buffer;
    try {
      imageBuffer = await readFromR2(photo.originalKey);
    } catch (readErr: any) {
      const errorMsg = String(readErr?.message || readErr);
      const isMissingKey =
        errorMsg.toLowerCase().includes("does not exist") ||
        errorMsg.toLowerCase().includes("nosuchkey");
      if (isMissingKey && photo.previewUrl) {
        const previewResponse = await fetch(photo.previewUrl).catch(() => null);
        if (previewResponse?.ok) {
          const previewArray = await previewResponse.arrayBuffer();
          imageBuffer = Buffer.from(previewArray);
          console.log("[analysis_v2] fallback_preview", {
            photoId: photo.id,
            originalKey: photo.originalKey,
            previewUrl: photo.previewUrl,
          });
        } else {
          throw new Error(`Error leyendo imagen desde R2: ${errorMsg}`);
        }
      } else {
        throw new Error(`Error leyendo imagen desde R2: ${errorMsg}`);
      }
    }
    timing.r2_read_ms = Date.now() - tR2;

    const tExif = Date.now();
    try {
      const exifResult = await processPhotoExifFromBuffer(
        {
          id: photo.id,
          albumId: photo.albumId,
          userId: photo.userId,
          albumUserId: photo.album.userId,
          createdAt: photo.createdAt,
          capturedAt: photo.capturedAt,
          storageDeletedAt: photo.storageDeletedAt,
          originalKey: photo.originalKey,
          exifMetadataStatus: photo.exifMetadataStatus,
          album: photo.album,
        },
        imageBuffer
      );
      timing.exif_ms = Date.now() - tExif;
      if (exifResult.outcome === "failed") {
        console.warn("[analysis_v2] exif_failed", {
          photoId: photo.id,
          error: exifResult.error,
        });
      }
    } catch (exifErr: unknown) {
      timing.exif_ms = Date.now() - tExif;
      console.warn("[analysis_v2] exif_failed", {
        photoId: photo.id,
        error: exifErr instanceof Error ? exifErr.message : String(exifErr),
      });
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error("Imagen vacía o no se pudo leer desde R2");
    }

    const bufferStart = imageBuffer.slice(0, 4);
    const isValidImageStart =
      (bufferStart[0] === 0xFF && bufferStart[1] === 0xD8) ||
      (bufferStart[0] === 0x89 && bufferStart[1] === 0x50 && bufferStart[2] === 0x4E && bufferStart[3] === 0x47) ||
      (bufferStart[0] === 0x47 && bufferStart[1] === 0x49 && bufferStart[2] === 0x46) ||
      (bufferStart[0] === 0x52 && bufferStart[1] === 0x49 && bufferStart[2] === 0x46 && bufferStart[3] === 0x46);

    if (!isValidImageStart) {
      throw new Error(`Imagen corrupta: buffer inválido (inicio: ${bufferStart.toString("hex")})`);
    }

    if (debug) {
      debugChecks.push({
        key: photo.originalKey,
        jobId: job.id,
        photoId: photo.id,
        contentType: r2Metadata?.contentType ?? null,
        size: r2Metadata?.size ?? null,
        length: imageBuffer.length,
      });
    }

    const tSharp = Date.now();
    let normalizedBuffer: Buffer;
    let imageFormat: string | undefined;
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error(`Imagen inválida: sin dimensiones (width: ${metadata.width}, height: ${metadata.height})`);
      }
      imageFormat = metadata.format;
      const supportedFormats = ["jpeg", "jpg", "png", "webp", "gif", "tiff", "heic", "heif"];
      if (!imageFormat || !supportedFormats.includes(imageFormat)) {
        throw new Error(`Formato de imagen no soportado: ${imageFormat || "desconocido"}`);
      }
      normalizedBuffer = await image
        .removeAlpha()
        .jpeg({
          quality: 90,
          mozjpeg: false,
          progressive: false,
          optimizeScans: false,
        })
        .withMetadata({})
        .toBuffer();
      const jpegStart = normalizedBuffer.slice(0, 2);
      if (jpegStart[0] !== 0xFF || jpegStart[1] !== 0xD8) {
        throw new Error(`Buffer normalizado no es JPEG válido (inicio: ${jpegStart.toString("hex")})`);
      }
    } catch (validationError: any) {
      const errorMsg = String(validationError?.message || validationError);
      const errorLower = errorMsg.toLowerCase();
      const isDecoderError =
        errorLower.includes("decoder") ||
        errorLower.includes("unsupported") ||
        errorLower.includes("vips") ||
        errorLower.includes("input buffer");
      if (isDecoderError && imageBuffer.length > 0) {
        normalizedBuffer = imageBuffer;
        imageFormat = "unknown";
      } else {
        throw validationError;
      }
    }
    timing.sharp_ms = Date.now() - tSharp;

    const tDb = Date.now();
    await prisma.faceDetection.deleteMany({ where: { photoId: photo.id } });
    if (includeOcr) {
      await prisma.ocrToken.deleteMany({ where: { photoId: photo.id } });
    }
    timing.db_write_ms = Date.now() - tDb;

    let ocrTokens: Awaited<ReturnType<typeof extractOcrTokensFromImage>> = [];
    if (includeOcr) {
      const tOcr = Date.now();
      try {
        const jpegStartCheck = normalizedBuffer.slice(0, 2);
        if (jpegStartCheck[0] !== 0xFF || jpegStartCheck[1] !== 0xD8) {
          throw new Error(
            `Buffer normalizado no es JPEG válido antes de Vision (inicio: ${jpegStartCheck.toString("hex")})`
          );
        }
        ocrTokens = await extractOcrTokensFromImage({ buffer: normalizedBuffer });
      } catch (err: any) {
        console.warn("[analysis_v2] ocr_failed", {
          photoId: photo.id,
          error: String(err?.message ?? err),
        });
        ocrTokens = [];
      }
      timing.ocr_ms = Date.now() - tOcr;
      if (ocrTokens.length > 0) {
        const tOcrDb = Date.now();
        await prisma.ocrToken.createMany({
          data: ocrTokens.map((t) => ({
            photoId: photo.id,
            textRaw: t.textRaw,
            textNorm: t.textNorm,
            confidence: t.confidence ?? null,
          })),
        });
        timing.db_write_ms += Date.now() - tOcrDb;
      }
    }

    let faces: Awaited<ReturnType<typeof indexFaces>> = [];
    let rekognitionBuffer = normalizedBuffer;
    const tRekIndex = Date.now();
    try {
      faces = await indexFaces({
        imageBytes: rekognitionBuffer,
        externalImageId: String(photo.id),
      });
    } catch (err: any) {
      const errorMsg = String(err?.message ?? err);
      const isInvalidFormat =
        errorMsg.toLowerCase().includes("invalid image format") ||
        errorMsg.toLowerCase().includes("invalidimage");
      if (isInvalidFormat && photo.previewUrl) {
        const previewResponse = await fetch(photo.previewUrl).catch(() => null);
        if (previewResponse?.ok) {
          const previewArray = await previewResponse.arrayBuffer();
          const previewBuffer = Buffer.from(previewArray);
          const previewNormalized = await sharp(previewBuffer)
            .removeAlpha()
            .jpeg({
              quality: 90,
              mozjpeg: false,
              progressive: false,
              optimizeScans: false,
            })
            .withMetadata({})
            .toBuffer();
          const jpegStart = previewNormalized.slice(0, 2);
          if (jpegStart[0] !== 0xff || jpegStart[1] !== 0xd8) {
            throw new Error("Buffer preview no es JPEG válido para Rekognition.");
          }
          rekognitionBuffer = previewNormalized;
          console.log("[analysis_v2] fallback_preview_invalid_format", {
            photoId: photo.id,
            originalKey: photo.originalKey,
            previewUrl: photo.previewUrl,
          });
          faces = await indexFaces({
            imageBytes: rekognitionBuffer,
            externalImageId: String(photo.id),
          });
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }
    timing.rekognition_index_ms = Date.now() - tRekIndex;

    if (faces.length > 0) {
      const tFaceDb = Date.now();
      await prisma.faceDetection.createMany({
        data: faces.map((f) => ({
          photoId: photo.id,
          rekognitionFaceId: f.rekognitionFaceId,
          confidence: f.confidence ?? null,
          bbox: f.bbox,
        })),
      });
      timing.db_write_ms += Date.now() - tFaceDb;

      const tRekSearch = Date.now();
      try {
        await matchFacesWithInterested(photo.id, photo.albumId, rekognitionBuffer);
      } catch (matchErr: any) {
        console.warn("[analysis_v2] match_failed", {
          photoId: photo.id,
          albumId: photo.albumId,
          error: String(matchErr?.message ?? matchErr),
        });
      }
      timing.rekognition_search_ms = Date.now() - tRekSearch;
    } else {
      timing.rekognition_search_ms = 0;
    }

    await prisma.photo.update({
      where: { id: photo.id },
      data: { analysisStatus: "DONE", analyzedAt: new Date(), analysisError: null },
    });
    await prisma.photoAnalysisJob.update({
      where: { id: job.id },
      data: { status: "DONE", lastError: null, lockedAt: null },
    });
    jobCompleted = true;

    const totalMs = Date.now() - tStart;
    console.log("[analysis_v2] photo_done", {
      photoId: photo.id,
      jobId: job.id,
      r2_read_ms: timing.r2_read_ms,
      exif_ms: timing.exif_ms,
      sharp_ms: timing.sharp_ms,
      rekognition_index_ms: timing.rekognition_index_ms,
      rekognition_search_ms: timing.rekognition_search_ms,
      db_write_ms: timing.db_write_ms,
      total_ms: totalMs,
      ocr_skipped_in_primary_pipeline: !includeOcr,
    });
    return { ok: true, photoId, debugChecks };
  } catch (err: any) {
    const message = String(err?.message ?? err);
    const errorLower = message.toLowerCase();
    const isInvalidImage =
      errorLower.includes("decoder") ||
      errorLower.includes("unsupported") ||
      errorLower.includes("invalid") ||
      errorLower.includes("corrupt") ||
      errorLower.includes("imagen inválida") ||
      errorLower.includes("formato no soportado") ||
      errorLower.includes("sin dimensiones");

    const nextAttempts = (job.attempts ?? 0) + 1;
    const shouldFail = isInvalidImage || nextAttempts >= MAX_ATTEMPTS;

    await prisma.photoAnalysisJob.update({
      where: { id: job.id },
      data: {
        status: shouldFail ? "ERROR" : "PENDING",
        attempts: nextAttempts,
        lastError: message,
        runAfter: shouldFail ? null : new Date(Date.now() + 10 * 60 * 1000),
        lockedAt: null,
      },
    });
    if (shouldFail) {
      await prisma.photo.update({
        where: { id: photoId },
        data: {
          analysisStatus: "ERROR",
          analysisError: isInvalidImage ? `Imagen inválida o corrupta: ${message}` : message,
        },
      });
    }
    jobCompleted = true;

    console.warn("[analysis_v2] photo_failed", {
      photoId,
      jobId: job.id,
      error: message,
      retry_scheduled: !shouldFail,
    });
    return { ok: false, photoId, error: message, debugChecks };
  } finally {
    if (!jobCompleted) {
      const currentJob = await prisma.photoAnalysisJob.findUnique({
        where: { id: job.id },
        select: { status: true },
      });
      if (currentJob?.status === "PROCESSING") {
        await prisma.photoAnalysisJob.update({
          where: { id: job.id },
          data: {
            status: "PENDING",
            lockedAt: null,
            runAfter: new Date(Date.now() + 5 * 60 * 1000),
          },
        });
        await prisma.photo.update({
          where: { id: photoId },
          data: {
            analysisStatus: "PENDING",
            analysisError: "Error no capturado durante procesamiento",
          },
        });
      }
    }
  }
}

export async function runAnalysisPipeline(options: RunOptions) {
  const now = new Date();
  const batchSize = resolveBatchSize();
  const concurrency = resolveConcurrency();
  const albumId =
    typeof options.albumId === "number" && Number.isFinite(options.albumId)
      ? options.albumId
      : undefined;
  const maxPhotoAgeDays = resolveMaxPhotoAgeDays();
  const ageCutoff =
    albumId == null && maxPhotoAgeDays != null
      ? photoCreatedAtCutoff(maxPhotoAgeDays, now)
      : null;

  const missingPhotos = await prisma.photo.findMany({
    where: {
      analysisJob: null,
      isRemoved: false,
      ...(albumId != null ? { albumId } : {}),
      ...(ageCutoff ? { createdAt: { gte: ageCutoff } } : {}),
      NOT: {
        OR: [
          { analysisError: { contains: "excluida del procesamiento automático" } },
          { analysisError: { contains: "Error en análisis - excluida del procesamiento automático" } },
          { analysisError: { contains: "Pendiente excluida del procesamiento automático" } },
          { analysisError: { contains: ANALYSIS_SUSPENDED_BY_AGE_PREFIX } },
        ],
      },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: albumId != null ? Math.max(batchSize, 50) : batchSize,
  });

  if (missingPhotos.length > 0) {
    await prisma.photoAnalysisJob.createMany({
      data: missingPhotos.map((p) => ({
        photoId: p.id,
        status: "PENDING",
      })),
      skipDuplicates: true,
    });
    await prisma.photo.updateMany({
      where: { id: { in: missingPhotos.map((p) => p.id) } },
      data: { analysisStatus: "PENDING", analysisError: null },
    });
  }

  const { jobsFound, locked } = await claimJobsAtomic(
    now,
    batchSize,
    albumId,
    maxPhotoAgeDays
  );
  const lockedJobIds = locked.map((j) => j.id);

  console.log("[analysis_v2] claim", {
    source: options.source,
    albumId: albumId ?? null,
    max_photo_age_days: maxPhotoAgeDays,
    jobs_claimed: jobsFound,
    jobs_locked_real: lockedJobIds.length,
    batch_size_config: batchSize,
    concurrency_config: concurrency,
    ocr_skipped_in_primary_pipeline: !options.includeOcr,
  });

  if (!lockedJobIds.length) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      backfilled: missingPhotos.length,
      jobs_claimed: jobsFound,
      jobs_locked_real: 0,
      albumId: albumId ?? null,
    });
  }

  const jobs = await prisma.photoAnalysisJob.findMany({
    where: { id: { in: lockedJobIds } },
    include: {
      photo: {
        select: {
          id: true,
          albumId: true,
          userId: true,
          originalKey: true,
          previewUrl: true,
          createdAt: true,
          capturedAt: true,
          storageDeletedAt: true,
          exifMetadataStatus: true,
          album: {
            select: {
              userId: true,
              deletedAt: true,
              isHidden: true,
              firstPhotoDate: true,
              expirationExtensionDays: true,
              cleanupStatus: true,
            },
          },
        },
      },
    },
  });

  const results = await runWithConcurrency(
    jobs,
    concurrency,
    (job) =>
      processJob(
        {
          id: job.id,
          photoId: job.photoId,
          attempts: job.attempts ?? null,
          photo: job.photo,
        },
        options.includeOcr,
        options.debug
      )
  );

  const processedOk = results.filter((r) => (r as { ok: boolean }).ok).length;
  const processedFail = results.length - processedOk;

  console.log("[analysis_v2] batch_done", {
    source: options.source,
    processed_ok: processedOk,
    processed_fail: processedFail,
    jobs_locked_real: lockedJobIds.length,
  });

  return NextResponse.json({
    ok: true,
    processed: processedOk,
    backfilled: missingPhotos.length,
    jobs_claimed: jobsFound,
    jobs_locked_real: lockedJobIds.length,
    processed_fail: processedFail,
    albumId: albumId ?? null,
  });
}
