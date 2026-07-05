import fs from "fs";
import { promises as fsPromises } from "fs";
import os from "os";
import path from "path";
import archiver from "archiver";
import { OrderItemType } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import {
  generateR2Key,
  uploadToR2,
  getSignedUrlForFile,
  fileExistsInR2,
} from "@/lib/r2-client";
import { safeFilename } from "./safe-filename";
import {
  markProcessing,
  setCurrentStep,
  updateProgress,
  markCompleted,
  markFailed,
} from "./zip-job-queue";
import { notifyClientDigitalZipReady } from "./zip-job-notifications";
import { readDigitalDeliveryBuffer } from "./digital-delivery-r2-key";

/** Fila mínima de Photo para ZIP (alineada al select de Prisma). */
type PhotoForZip = {
  id: number;
  originalKey: string;
  previewUrl: string;
};

function isUsablePhotoForZip(
  p: { id: number; originalKey: string; previewUrl: string } | null | undefined
): p is PhotoForZip {
  return Boolean(p && (p.originalKey || p.previewUrl));
}

async function resolvePhotosForJob(job: {
  photoIds: Array<string | number>;
  orderId?: number | null;
  albumId?: number | null;
}): Promise<PhotoForZip[]> {
  const numericIds = job.photoIds
    .map((value) => Number(value))
    .filter((num) => Number.isFinite(num));

  if (numericIds.length) {
    const photos = await prisma.photo.findMany({
      where: { id: { in: numericIds } },
      select: { id: true, originalKey: true, previewUrl: true },
    });
    const byId = new Map(photos.map((p) => [p.id, p]));
    const ordered = numericIds
      .map((id) => byId.get(id))
      .filter(isUsablePhotoForZip);
    if (ordered.length < numericIds.length) {
      const missing = numericIds.filter((id) => !byId.has(id));
      throw new Error(`Fotos no encontradas: ${missing.join(",")}`);
    }
    return ordered;
  }

  if (job.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: job.orderId },
      include: {
        items: {
          where: { productType: OrderItemType.DIGITAL },
          include: {
            photo: {
              select: { id: true, originalKey: true, previewUrl: true },
            },
          },
        },
      },
    });
    if (order) {
      return order.items
        .map((item) => item.photo)
        .filter(isUsablePhotoForZip);
    }
  }

  if (job.albumId) {
    const photos = await prisma.photo.findMany({
      where: { albumId: job.albumId, isRemoved: false },
      select: { id: true, originalKey: true, previewUrl: true },
    });
    return photos.filter(isUsablePhotoForZip);
  }

  return [];
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
  await setCurrentStep(jobId, "PROCESSING").catch(() => null);
  console.log(`[ZIP] start job ${jobId}`);

  try {
    const photos = await resolvePhotosForJob(job);
    console.log(`[ZIP] resolved ${photos.length} photo(s) for job ${jobId}`);

    if (!photos.length) {
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

    let processed = 0;
    let appended = 0;
    const total = photos.length;
    const failures: string[] = [];

    const archiveCompletion = new Promise<void>((resolve, reject) => {
      outputStream.on("close", () => resolve());
      outputStream.on("error", (err) => reject(err));
      archive.on("warning", (warning) => {
        console.warn(`[ZIP] warning for job ${jobId}:`, warning);
      });
      archive.on("error", (err) => reject(err));
    });

    for (const photo of photos) {
      processed += 1;
      try {
        const { buffer, r2Key } = await readDigitalDeliveryBuffer(photo);
        const rawName = r2Key.split("/").pop() || `photo-${photo.id}.jpg`;
        const filename = safeFilename(rawName, `photo-${photo.id}`);
        archive.append(buffer, { name: filename });
        appended += 1;
        console.log(`[ZIP] appended ${appended}/${total} for job ${jobId}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        failures.push(`photo ${photo.id}: ${msg}`);
        console.error(`[ZIP] job ${jobId}: fallo photo ${photo.id}:`, error);
      } finally {
        await updateProgress(jobId, processed, total).catch((err) =>
          console.error("ZIP progress update failed", err)
        );
      }
    }

    if (appended === 0) {
      await markFailed(
        jobId,
        failures.length
          ? failures.join(" | ")
          : "No se pudo agregar ninguna foto al ZIP"
      );
      return;
    }

    if (failures.length > 0) {
      await markFailed(
        jobId,
        `ZIP incompleto (${appended}/${total}): ${failures.join(" | ")}`
      );
      return;
    }

    await setCurrentStep(jobId, "ZIPPING").catch(() => null);
    await archive.finalize();
    await archiveCompletion;

    const stat = await fsPromises.stat(tempFilePath);
    if (stat.size < 100) {
      await markFailed(jobId, "ZIP generado vacío o demasiado pequeño");
      await fsPromises.rm(tempFilePath).catch(() => null);
      return;
    }

    await setCurrentStep(jobId, "UPLOADING").catch(() => null);
    const key = generateR2Key(`zip-${jobId}.zip`, "zip-jobs");

    const timeoutMs = Math.max(180000, total * 45000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      await uploadToR2(tempFilePath, key, "application/zip", { jobId }, controller.signal);
    } finally {
      clearTimeout(timeoutId);
      await fsPromises.rm(tempFilePath).catch(() => null);
    }

    if (!(await fileExistsInR2(key))) {
      await markFailed(jobId, "Upload a R2 completó pero el archivo no está disponible");
      return;
    }

    const signedUrl = await getSignedUrlForFile(key, 24 * 60 * 60);

    const completedJob = await markCompleted(jobId, {
      r2Key: key,
      zipUrl: signedUrl,
      expiresAt: job.expiresAt,
    });
    await setCurrentStep(jobId, "COMPLETED").catch(() => null);

    if (completedJob) {
      try {
        await notifyClientDigitalZipReady(completedJob);
      } catch (error) {
        console.error("Error notificando al cliente que el ZIP está listo:", error);
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await markFailed(jobId, message);
    await setCurrentStep(jobId, "FAILED").catch(() => null);
    console.error(`Zip job ${jobId} falló:`, error);
    throw error;
  }
}
