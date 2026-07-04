import fs from "fs";
import { promises as fsPromises } from "fs";
import os from "os";
import path from "path";
import archiver from "archiver";
import { prisma } from "@/lib/prisma";
import {
  readFromR2,
  generateR2Key,
  uploadToR2,
  urlToR2Key,
  getSignedUrlForFile,
} from "@/lib/r2-client";
import { safeFilename } from "./safe-filename";
import {
  markProcessing,
  updateProgress,
  markCompleted,
  markFailed,
} from "./zip-job-queue";
import { notifyClientDigitalZipReady } from "./zip-job-notifications";

async function resolvePhotoKeys(job: {
  photoIds: Array<string | number>;
  orderId?: number | null;
  albumId?: number | null;
}) {
  const numericIds = job.photoIds
    .map((value) => Number(value))
    .filter((num) => Number.isFinite(num));

  const keys: string[] = [];
  const foundIds = new Set<number>();

  if (numericIds.length) {
    const photos = await prisma.photo.findMany({
      where: {
        id: { in: numericIds },
      },
      select: {
        id: true,
        originalKey: true,
      },
    });
    photos.forEach((photo) => {
      const candidate = photo.originalKey;
      if (candidate) {
        keys.push(candidate);
        foundIds.add(photo.id);
      }
    });
    if (numericIds.length && foundIds.size < numericIds.length) {
      const missing = numericIds.filter((id) => !foundIds.has(id));
      throw new Error(
        `Fotos no encontradas o sin originalKey: ${missing.join(",")}`
      );
    }
  }

  if (keys.length) {
    return keys;
  }

  if (job.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: job.orderId },
      include: {
        items: {
          include: {
            photo: true,
          },
        },
      },
    });
    if (order) {
      order.items.forEach((item) => {
        const candidate = item.photo?.originalKey;
        if (candidate) keys.push(candidate);
      });
    }
  }

  if (!keys.length && job.albumId) {
    const photos = await prisma.photo.findMany({
      where: { albumId: job.albumId },
      select: { originalKey: true },
    });
    photos.forEach((photo) => {
      const candidate = photo.originalKey;
      if (candidate) keys.push(candidate);
    });
  }

  return keys;
}

export async function generateZipForJob(jobId: string): Promise<void> {
  const job = await prisma.zipGenerationJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error(`Zip job ${jobId} no encontrado`);
  }

  if (job.status !== "PENDING") {
    return;
  }

  await markProcessing(jobId);
  console.log(`[ZIP] start job ${jobId}`);

  try {
    const photoKeys = await resolvePhotoKeys(job);
    console.log(
      `[ZIP] resolved photo keys (${photoKeys.length}) for job ${jobId}`
    );

    if (!photoKeys.length) {
      await markFailed(jobId, "No se encontraron fotos para el job");
      return;
    }

    const archive = archiver("zip", { zlib: { level: 9 } });
    const tempFilePath = path.join(
      os.tmpdir(),
      `zip-${jobId}-${Date.now()}.zip`
    );
    const outputStream = fs.createWriteStream(tempFilePath);
    archive.pipe(outputStream);
    console.log(`[ZIP] creating zip stream for job ${jobId}`);

    let processed = 0;
    const total = photoKeys.length;

    const archiveCompletion = new Promise<void>((resolve, reject) => {
      outputStream.on("close", () => resolve());
      outputStream.on("error", (err) => reject(err));
      archive.on("warning", (warning) => {
        console.warn(`[ZIP] warning for job ${jobId}:`, warning);
      });
      archive.on("error", (err) => reject(err));
    });

    for (const originalKey of photoKeys) {
      try {
        const r2Key = urlToR2Key(originalKey);
        const buffer = await readFromR2(r2Key);
        const rawName = r2Key.split("/").pop() || `photo-${processed + 1}`;
        const filename = safeFilename(rawName, `photo-${processed + 1}`);
        archive.append(buffer, { name: filename });
        processed += 1;
        console.log(
          `[ZIP] appended ${processed}/${total} items for job ${jobId}`
        );
      } catch (error) {
        console.error(`ZIP ${jobId}: no se pudo leer ${originalKey}`, error);
        processed += 1;
      } finally {
        await updateProgress(jobId, processed, total).catch((err) =>
          console.error("ZIP progress update failed", err)
        );
      }
    }

    await archive.finalize();
    console.log(`[ZIP] archive finalized for job ${jobId}`);
    await archiveCompletion;

    const key = generateR2Key(`zip-${jobId}.zip`, "zip-jobs");
    console.log(`[ZIP] uploading to R2 key=${key}`);

    const totalItems = photoKeys.length;
    const timeoutMs = Math.max(180000, totalItems * 45000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      await uploadToR2(tempFilePath, key, "application/zip", { jobId }, controller.signal);
      console.log(`[ZIP] upload finished for key=${key}`);
    } finally {
      clearTimeout(timeoutId);
      await fsPromises.rm(tempFilePath).catch(() => null);
    }

    const signedUrl = await getSignedUrlForFile(key, 24 * 60 * 60);
    console.log(`[ZIP] presigned url generated for job ${jobId}`);

    const completedJob = await markCompleted(jobId, {
      r2Key: key,
      zipUrl: signedUrl,
      expiresAt: job.expiresAt,
    });
    console.log(`[ZIP] markCompleted for job ${jobId}`);

    if (completedJob) {
      try {
        await notifyClientDigitalZipReady(completedJob);
      } catch (error) {
        console.error("Error notificando al cliente que el ZIP está listo:", error);
      }
    }
  } catch (error: any) {
    const message = String(error?.message || error);
    await markFailed(jobId, message);
    console.error(`Zip job ${jobId} falló:`, error);
    throw error;
  }
}
