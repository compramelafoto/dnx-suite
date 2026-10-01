import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { PrismaClient } from "@repo/db";
import type { WorkerConfig } from "./config.js";
import {
  assertFfmpegAvailable,
  buildPreviewMp4,
  generateThumbnail,
  probeVideo,
} from "./ffmpeg.js";
import { extractFrame, frameKey, planFrameTimes } from "./frames.js";
import { getPrisma } from "./prisma.js";
import {
  downloadFromR2,
  previewKey,
  thumbnailKey,
  uploadFileToR2,
} from "./r2.js";
import { recoverStaleJobs } from "./recover-stale-jobs.js";

export type ClaimedJob = {
  id: string;
  videoId: number;
  attempts: number;
};

function shortError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 500);
}

function backoffMs(attempts: number): number {
  const base = 60_000;
  return base * Math.max(1, attempts);
}

export async function claimNextJob(prisma: PrismaClient): Promise<ClaimedJob | null> {
  const now = new Date();
  const rows = await prisma.$queryRaw<
    Array<{ id: string; videoId: number; attempts: number }>
  >`
    WITH next_job AS (
      SELECT id
      FROM "VideoProcessingJob"
      WHERE status = 'PENDING'
        AND ("runAfter" IS NULL OR "runAfter" <= ${now})
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "VideoProcessingJob" AS j
    SET
      status = 'PROCESSING',
      "lockedAt" = ${now},
      attempts = j.attempts + 1,
      "updatedAt" = ${now}
    FROM next_job
    WHERE j.id = next_job.id
    RETURNING j.id, j."videoId", j.attempts
  `;

  const row = rows[0];
  if (!row) return null;

  await prisma.videoAsset.update({
    where: { id: row.videoId },
    data: {
      processingStatus: "PROCESSING",
      processingError: null,
    },
  });

  return row;
}

async function markJobFailed(
  prisma: PrismaClient,
  job: ClaimedJob,
  message: string,
  maxAttempts: number
) {
  const exhausted = job.attempts >= maxAttempts;

  if (exhausted) {
    await prisma.$transaction([
      prisma.videoProcessingJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          lastError: message,
          lockedAt: null,
        },
      }),
      prisma.videoAsset.update({
        where: { id: job.videoId },
        data: {
          processingStatus: "FAILED",
          processingError: message,
        },
      }),
    ]);
    return;
  }

  const runAfter = new Date(Date.now() + backoffMs(job.attempts));
  await prisma.$transaction([
    prisma.videoProcessingJob.update({
      where: { id: job.id },
      data: {
        status: "PENDING",
        lastError: message,
        lockedAt: null,
        runAfter,
      },
    }),
    prisma.videoAsset.update({
      where: { id: job.videoId },
      data: {
        processingStatus: "UPLOADED",
        processingError: null,
      },
    }),
  ]);
}

/**
 * Cierra un job que no corresponde procesar (video borrado o vencido).
 *
 * No es un fallo del worker, así que no se reintenta: descargar de nuevo un
 * original de cientos de megas para volver a descubrir que está vencido cuesta
 * tiempo de máquina y no sirve para nada.
 */
async function markJobObsolete(
  prisma: PrismaClient,
  job: ClaimedJob,
  reason: string
) {
  await prisma.$transaction([
    prisma.videoProcessingJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        lastError: reason,
        lockedAt: null,
        runAfter: null,
      },
    }),
    // EXPIRED es el estado terminal de "no se procesa más": el job ya lo tomó
    // y lo dejó en PROCESSING, así que hay que sacarlo de ahí igual que si
    // hubiera vencido, o el video queda colgado en "procesando" para siempre.
    prisma.videoAsset.update({
      where: { id: job.videoId },
      data: { processingStatus: "EXPIRED", processingError: reason },
    }),
  ]);
}

async function markJobCompleted(
  prisma: PrismaClient,
  job: ClaimedJob,
  data: {
    albumId: number;
    thumbKey: string;
    prevKey: string;
    probe: Awaited<ReturnType<typeof probeVideo>>;
  }
) {
  const durationSeconds = Math.max(1, Math.round(data.probe.durationSeconds));

  await prisma.$transaction([
    prisma.videoAsset.update({
      where: { id: job.videoId },
      data: {
        processingStatus: "READY",
        processingError: null,
        thumbnailKey: data.thumbKey,
        previewKey: data.prevKey,
        durationSeconds,
        width: data.probe.width,
        height: data.probe.height,
        orientation: data.probe.orientation,
      },
    }),
    prisma.videoProcessingJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        lastError: null,
        lockedAt: null,
        runAfter: null,
      },
    }),
  ]);
}

/**
 * Extrae fotogramas del original y los registra para el análisis facial.
 *
 * Corre DESPUÉS de que la preview quedó lista y fuera de la transacción del
 * job: si la extracción falla, el video igual queda publicable. Reconocer caras
 * es un extra, no una condición para vender.
 */
async function extractAndRegisterFrames(
  prisma: PrismaClient,
  config: WorkerConfig,
  video: { id: number; albumId: number },
  originalLocal: string,
  workDir: string,
  durationSeconds: number
): Promise<number> {
  const count = config.VIDEO_WORKER_FRAME_COUNT;
  const tiempos = planFrameTimes({ durationSeconds, count });
  if (tiempos.length === 0) return 0;

  let registrados = 0;

  for (const timeSeconds of tiempos) {
    const frame = await extractFrame(originalLocal, workDir, timeSeconds);
    if (!frame) continue;

    const key = frameKey(video.albumId, video.id, timeSeconds);

    try {
      await uploadFileToR2(config, frame.localPath, key, "image/jpeg");
      // El unique de (videoId, timeSeconds) hace que reprocesar no duplique.
      await prisma.videoFrame.upsert({
        where: { videoId_timeSeconds: { videoId: video.id, timeSeconds } },
        create: {
          videoId: video.id,
          albumId: video.albumId,
          key,
          timeSeconds,
          width: frame.width,
          height: frame.height,
        },
        update: { key, width: frame.width, height: frame.height },
      });
      registrados += 1;
    } catch (err: unknown) {
      console.warn("[video-worker] no se pudo registrar el fotograma", {
        videoId: video.id,
        timeSeconds,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.info("[video-worker] fotogramas listos", {
    videoId: video.id,
    pedidos: tiempos.length,
    registrados,
  });

  return registrados;
}

export async function processClaimedJob(
  config: WorkerConfig,
  job: ClaimedJob
): Promise<{ ok: true } | { ok: false; error: string }> {
  const prisma = getPrisma();
  const maxAttempts = config.VIDEO_WORKER_MAX_ATTEMPTS;

  const video = await prisma.videoAsset.findUnique({
    where: { id: job.videoId },
    select: {
      id: true,
      albumId: true,
      originalKey: true,
      isRemoved: true,
      expiresAt: true,
    },
  });

  if (!video) {
    const msg = "Video no encontrado";
    await markJobFailed(prisma, job, msg, maxAttempts);
    return { ok: false, error: msg };
  }

  // El fotógrafo lo borró mientras esperaba en la cola.
  if (video.isRemoved) {
    const msg = "Video eliminado por el fotógrafo";
    console.info("[video-worker] job obsoleto", { videoId: video.id, reason: msg });
    await markJobObsolete(prisma, job, msg);
    return { ok: false, error: msg };
  }

  // Ya pasó su ventana de publicación: la galería pública no lo mostraría.
  if (video.expiresAt.getTime() <= Date.now()) {
    const msg = `Video vencido el ${video.expiresAt.toISOString().slice(0, 10)}`;
    console.info("[video-worker] job obsoleto", { videoId: video.id, reason: msg });
    await markJobObsolete(prisma, job, msg);
    return { ok: false, error: msg };
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `clf-video-${video.id}-`));

  try {
    await assertFfmpegAvailable();

    const originalLocal = path.join(workDir, "original");
    await downloadFromR2(config, video.originalKey, originalLocal);

    const probe = await probeVideo(originalLocal);

    const scaleOpts = {
      videoId: video.id,
      orientation: probe.orientation,
      rotationDegrees: probe.rotationDegrees,
    };

    const thumbLocal = path.join(workDir, "thumb.jpg");
    await generateThumbnail(originalLocal, thumbLocal, probe.durationSeconds, scaleOpts);

    const previewLocal = await buildPreviewMp4(
      originalLocal,
      workDir,
      probe.durationSeconds,
      video.id,
      scaleOpts
    );

    const thumbR2 = thumbnailKey(video.albumId, video.id);
    const prevR2 = previewKey(video.albumId, video.id);

    await uploadFileToR2(config, thumbLocal, thumbR2, "image/jpeg");
    await uploadFileToR2(config, previewLocal, prevR2, "video/mp4");

    await markJobCompleted(prisma, job, {
      albumId: video.albumId,
      thumbKey: thumbR2,
      prevKey: prevR2,
      probe,
    });

    // El video ya está publicable. Los fotogramas son un extra: si fallan, se
    // loguea y el job queda completado igual.
    let frames = 0;
    try {
      frames = await extractAndRegisterFrames(
        prisma,
        config,
        video,
        originalLocal,
        workDir,
        probe.durationSeconds
      );
    } catch (frameErr: unknown) {
      console.warn("[video-worker] extracción de fotogramas falló", {
        videoId: video.id,
        error: frameErr instanceof Error ? frameErr.message : String(frameErr),
      });
    }

    console.info("[video-worker] completed", {
      jobId: job.id,
      videoId: video.id,
      albumId: video.albumId,
      durationSeconds: probe.durationSeconds,
      frames,
    });

    return { ok: true };
  } catch (err) {
    const msg = shortError(err);
    console.error("[video-worker] job failed", {
      jobId: job.id,
      videoId: job.videoId,
      attempts: job.attempts,
      error: msg,
    });
    await markJobFailed(prisma, job, msg, maxAttempts);
    return { ok: false, error: msg };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function runProcessOnce(config: WorkerConfig): Promise<boolean> {
  const prisma = getPrisma();

  const recovery = await recoverStaleJobs(prisma, config);
  if (recovery.recovered > 0 || recovery.failed > 0) {
    console.info("[video-worker] stale job recovery", recovery);
  }

  const job = await claimNextJob(prisma);
  if (!job) {
    console.info("[video-worker] no pending jobs");
    return false;
  }

  console.info("[video-worker] claimed job", job);
  await processClaimedJob(config, job);
  return true;
}
