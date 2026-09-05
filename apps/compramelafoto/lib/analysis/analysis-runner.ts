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
import {
  resolveBatchSize,
  resolveConcurrency,
  resolveMaxRunMs,
  shouldRunAnotherRound,
} from "@/lib/analysis/analysis-throughput";
import sharp from "sharp";

const MAX_ATTEMPTS = 3;

type RunOptions = {
  includeOcr: boolean;
  debug: boolean;
  source: "cron" | "admin";
  /** Si se indica, solo crea/claim jobs de ese álbum (útil para destrabar galerías grandes). */
  albumId?: number;
  /**
   * Presupuesto de pared de la corrida. El cron usa el máximo de la función; el panel
   * de admin pasa uno corto para que la respuesta no cuelgue en el navegador.
   */
  maxRunMs?: number;
};

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

/** Crea los jobs faltantes de fotos que nunca entraron a la cola. */
async function backfillMissingJobs(
  batchSize: number,
  albumId: number | undefined,
  ageCutoff: Date | null
): Promise<number> {
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
    take: Math.max(batchSize, 50),
  });

  if (missingPhotos.length === 0) return 0;

  await prisma.photoAnalysisJob.createMany({
    data: missingPhotos.map((p) => ({ photoId: p.id, status: "PENDING" as const })),
    skipDuplicates: true,
  });
  await prisma.photo.updateMany({
    where: { id: { in: missingPhotos.map((p) => p.id) } },
    data: { analysisStatus: "PENDING", analysisError: null },
  });
  return missingPhotos.length;
}

/**
 * Procesa la cola de análisis hasta vaciarla o hasta agotar el presupuesto de tiempo.
 *
 * No hay tope de fotos por corrida: antes se tomaba un lote fijo de 2 y se devolvía,
 * lo que daba ~288 fotos por día y dejaba álbumes enteros esperando días con el
 * reconocimiento facial apagado. Ahora lo único que corta la corrida es el reloj de
 * la función (`maxDuration`), y el cron siguiente retoma donde quedó.
 */
export async function runAnalysisPipeline(options: RunOptions) {
  const startedAt = Date.now();
  const batchSize = resolveBatchSize();
  const concurrency = resolveConcurrency();
  const maxRunMs = options.maxRunMs ?? resolveMaxRunMs();
  const albumId =
    typeof options.albumId === "number" && Number.isFinite(options.albumId)
      ? options.albumId
      : undefined;
  const maxPhotoAgeDays = resolveMaxPhotoAgeDays();

  let totalOk = 0;
  let totalFail = 0;
  let totalBackfilled = 0;
  let totalLocked = 0;
  let rounds = 0;
  let lastRoundLocked = 0;
  let lastRoundMs = 0;

  do {
    const roundStartedAt = Date.now();
    const now = new Date(roundStartedAt);
    const ageCutoff =
      albumId == null && maxPhotoAgeDays != null
        ? photoCreatedAtCutoff(maxPhotoAgeDays, now)
        : null;

    totalBackfilled += await backfillMissingJobs(batchSize, albumId, ageCutoff);

    const { jobsFound, locked } = await claimJobsAtomic(
      now,
      batchSize,
      albumId,
      maxPhotoAgeDays
    );
    const lockedJobIds = locked.map((j) => j.id);
    lastRoundLocked = lockedJobIds.length;
    totalLocked += lockedJobIds.length;

    if (lockedJobIds.length === 0) {
      console.log("[analysis_v2] queue_empty", {
        source: options.source,
        albumId: albumId ?? null,
        jobs_claimed: jobsFound,
        rounds_done: rounds,
        processed_total: totalOk,
      });
      lastRoundMs = Date.now() - roundStartedAt;
      break;
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
    totalOk += processedOk;
    totalFail += results.length - processedOk;
    rounds += 1;
    lastRoundMs = Date.now() - roundStartedAt;

    console.log("[analysis_v2] round_done", {
      source: options.source,
      albumId: albumId ?? null,
      round: rounds,
      processed_ok: processedOk,
      processed_fail: results.length - processedOk,
      jobs_locked_real: lockedJobIds.length,
      round_ms: lastRoundMs,
      elapsed_ms: Date.now() - startedAt,
      batch_size_config: batchSize,
      concurrency_config: concurrency,
      max_run_ms: maxRunMs,
      ocr_skipped_in_primary_pipeline: !options.includeOcr,
    });
  } while (
    shouldRunAnotherRound({
      elapsedMs: Date.now() - startedAt,
      maxRunMs,
      lastRoundLocked,
      lastRoundMs,
      processedSoFar: totalOk,
    })
  );

  const durationMs = Date.now() - startedAt;
  const stoppedByTime = lastRoundLocked > 0;

  console.log("[analysis_v2] run_done", {
    source: options.source,
    albumId: albumId ?? null,
    max_photo_age_days: maxPhotoAgeDays,
    rounds,
    processed_ok: totalOk,
    processed_fail: totalFail,
    jobs_locked_real: totalLocked,
    backfilled: totalBackfilled,
    duration_ms: durationMs,
    stopped_by_time_budget: stoppedByTime,
  });

  return NextResponse.json({
    ok: true,
    processed: totalOk,
    processed_fail: totalFail,
    backfilled: totalBackfilled,
    jobs_claimed: totalLocked,
    jobs_locked_real: totalLocked,
    rounds,
    duration_ms: durationMs,
    stopped_by_time_budget: stoppedByTime,
    albumId: albumId ?? null,
  });
}
