import type { AlbumCleanupStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteFromR2, listObjectsByPrefix, urlToR2Key } from "@/lib/r2-client";
import { getAlbumCleanupConfig, type AlbumCleanupConfig } from "@/lib/album-cleanup/config";
import {
  detectAlbumDeleteBlockers,
  getPhotoOrderItemBlockers,
  hasActivePrintOrdersForFileKeys,
} from "@/lib/album-cleanup/blockers";
import { tryDestructiveAlbumRowDelete } from "@/lib/album-cleanup/destructive-delete";
import {
  isAlbumPastHideDate,
  isAlbumPastPurgeDate,
} from "@/lib/album-cleanup/eligibility";
import {
  deletePhotoRowIfAllowed,
  purgePhotoStorageAndMetadata,
} from "@/lib/album-cleanup/purge-photo-storage";
import {
  nextProcessedCount,
  planPhotoBatch,
} from "@/lib/album-cleanup/resume-cursor";
import type { AlbumBlockerReport, DestructiveAlbumDeleteAttempt } from "@/lib/album-cleanup/types";

export type AlbumCleanupRunLog = {
  startedAt: string;
  durationMs: number;
  config: ReturnType<typeof getAlbumCleanupConfig>;
  hiddenAlbums: number;
  enqueuedAlbums: number;
  selectedAlbumIds: number[];
  skippedAlbums: Array<{ albumId: number; reason: string }>;
  processedAlbums: Array<{
    albumId: number;
    status: AlbumCleanupStatus;
    photosProcessed: number;
    photosPurged: number;
    photosDeleted: number;
    externalOps: number;
    destructiveDelete: boolean;
    blockers?: string | null;
    albumTableBlockers?: boolean;
    photoRowBlockers?: boolean;
    destructiveAttempt?: DestructiveAlbumDeleteAttempt | null;
    error?: string;
  }>;
  failedAlbums: Array<{ albumId: number; stage: string; error: string }>;
  totals: {
    photosProcessed: number;
    photosPurged: number;
    photosDeleted: number;
    externalOps: number;
    pendingAlbums: number;
    pendingPhotos: number;
  };
  deletedEventCovers: number;
  cleanedPrintOrders: number;
  deletedPrintFiles: number;
};

type Budget = {
  photosRemaining: number;
  externalOpsRemaining: number;
  albumsRemaining: number;
};

function budgetExhausted(b: Budget): boolean {
  return b.photosRemaining <= 0 || b.albumsRemaining <= 0 || b.externalOpsRemaining <= 0;
}

export async function hideExpiredAlbums(now = new Date()): Promise<number> {
  const albums = await prisma.album.findMany({
    where: { firstPhotoDate: { not: null }, isHidden: false },
    select: {
      id: true,
      firstPhotoDate: true,
      expirationExtensionDays: true,
      isHidden: true,
      deletedAt: true,
      cleanupStatus: true,
    },
  });

  let hidden = 0;
  for (const album of albums) {
    if (!isAlbumPastHideDate(album, now)) continue;
    await prisma.album.update({
      where: { id: album.id },
      data: { isHidden: true },
    });
    hidden += 1;
  }
  return hidden;
}

export async function enqueueExpiredAlbums(now = new Date()): Promise<number> {
  const albums = await prisma.album.findMany({
    where: {
      firstPhotoDate: { not: null },
      isHidden: true,
      cleanupStatus: { in: ["NONE", "FAILED"] },
    },
    select: {
      id: true,
      firstPhotoDate: true,
      expirationExtensionDays: true,
      isHidden: true,
      deletedAt: true,
      cleanupStatus: true,
    },
  });

  let enqueued = 0;
  for (const album of albums) {
    if (!isAlbumPastPurgeDate(album, now)) continue;
    const activePhotos = await prisma.photo.count({
      where: { albumId: album.id, storageCleanupStatus: "ACTIVE" },
    });
    if (activePhotos === 0) continue;

    await prisma.album.update({
      where: { id: album.id },
      data: {
        cleanupStatus: "PENDING",
        cleanupPendingAt: now,
        cleanupLastError: null,
        cleanupBlockReason: null,
        cleanupPhotosProcessed: 0,
      },
    });
    enqueued += 1;
  }
  return enqueued;
}

async function finalizeAlbumCleanup(
  albumId: number,
  config: AlbumCleanupConfig
): Promise<{
  status: AlbumCleanupStatus;
  blockers: AlbumBlockerReport;
  destructiveAttempt: DestructiveAlbumDeleteAttempt | null;
}> {
  const blockers = await detectAlbumDeleteBlockers(albumId);

  const remainingActive = await prisma.photo.count({
    where: { albumId, storageCleanupStatus: "ACTIVE" },
  });

  if (remainingActive > 0) {
    await prisma.album.update({
      where: { id: albumId },
      data: {
        cleanupStatus: "PROCESSING",
        cleanupLastError: null,
      },
    });
    console.info(
      "[album-cleanup] album still processing",
      JSON.stringify({
        albumId,
        destructiveDelete: config.destructiveDelete,
        remainingActivePhotos: remainingActive,
        blockers: blockers.primaryReason,
        status: "PROCESSING",
      })
    );
    return { status: "PROCESSING", blockers, destructiveAttempt: null };
  }

  const hasReferences =
    blockers.hasAlbumTableBlockers || blockers.remainingPhotoRows > 0;

  let destructiveAttempt: DestructiveAlbumDeleteAttempt | null = null;
  let status: AlbumCleanupStatus;

  if (config.destructiveDelete) {
    destructiveAttempt = await tryDestructiveAlbumRowDelete(albumId, blockers);
    status = destructiveAttempt.albumDeleted
      ? "COMPLETED"
      : "COMPLETED_WITH_REFERENCES";
  } else {
    status = hasReferences ? "COMPLETED_WITH_REFERENCES" : "COMPLETED";
  }

  const cleanupLastError = destructiveAttempt?.error?.slice(0, 2000) ?? null;

  // Si la fila no se pudo borrar (ventas, invitaciones y demás FK que la base
  // protege por integridad contable), el álbum queda como cascarón sin fotos.
  // El soft delete apaga la página pública (page.tsx devuelve notFound) para que
  // a los 45 días el álbum desaparezca de cara al usuario igual que si se hubiera
  // borrado la fila.
  const albumRowSurvives = !destructiveAttempt?.albumDeleted;

  if (albumRowSurvives) {
    await prisma.album.update({
      where: { id: albumId },
      data: {
        cleanupStatus: status,
        cleanupCompletedAt: new Date(),
        cleanupLastError,
        cleanupBlockReason: hasReferences ? blockers.primaryReason : null,
        deletedAt: new Date(),
        isHidden: true,
      },
    });
  }

  console.info(
    "[album-cleanup] album finalized",
    JSON.stringify({
      albumId,
      destructiveDelete: config.destructiveDelete,
      albumTableBlockers: blockers.hasAlbumTableBlockers,
      photoRowBlockers: blockers.hasPhotoRowBlockers,
      remainingPhotoRows: blockers.remainingPhotoRows,
      blockers: blockers.primaryReason,
      destructiveAttempt,
      finalStatus: status,
    })
  );

  return { status, blockers, destructiveAttempt };
}

async function purgeAlbumRawUploads(albumId: number): Promise<number> {
  let deleted = 0;
  try {
    const rawPrefix = `albums/${albumId}/raw/`;
    const rawObjects = await listObjectsByPrefix(rawPrefix);
    for (const obj of rawObjects) {
      await deleteFromR2(obj.Key).catch(() => {});
      deleted += 1;
    }
  } catch {
    /* best-effort */
  }
  return deleted;
}

/** Miniaturas de portada (recortes de fotos y portadas propias subidas a mano). */
async function purgeAlbumCovers(albumId: number): Promise<number> {
  let deleted = 0;
  try {
    const coverObjects = await listObjectsByPrefix(`album-covers/${albumId}/`);
    for (const obj of coverObjects) {
      await deleteFromR2(obj.Key).catch(() => {});
      deleted += 1;
    }
  } catch {
    /* best-effort */
  }
  return deleted;
}

export async function processAlbumCleanupBatch(
  now = new Date()
): Promise<AlbumCleanupRunLog> {
  const started = Date.now();
  const config = getAlbumCleanupConfig();
  const log: AlbumCleanupRunLog = {
    startedAt: new Date(started).toISOString(),
    durationMs: 0,
    config,
    hiddenAlbums: 0,
    enqueuedAlbums: 0,
    selectedAlbumIds: [],
    skippedAlbums: [],
    processedAlbums: [],
    failedAlbums: [],
    totals: {
      photosProcessed: 0,
      photosPurged: 0,
      photosDeleted: 0,
      externalOps: 0,
      pendingAlbums: 0,
      pendingPhotos: 0,
    },
    deletedEventCovers: 0,
    cleanedPrintOrders: 0,
    deletedPrintFiles: 0,
  };

  if (!config.enabled) {
    log.durationMs = Date.now() - started;
    return log;
  }

  log.hiddenAlbums = await hideExpiredAlbums(now);
  log.enqueuedAlbums = await enqueueExpiredAlbums(now);

  const budget: Budget = {
    albumsRemaining: config.maxAlbumsPerRun,
    photosRemaining: config.maxPhotosPerRun,
    externalOpsRemaining: config.maxExternalOpsPerRun,
  };

  const candidates = await prisma.album.findMany({
    where: { cleanupStatus: { in: ["PENDING", "PROCESSING"] } },
    orderBy: [{ cleanupPendingAt: "asc" }, { id: "asc" }],
    take: config.maxAlbumsPerRun,
    select: {
      id: true,
      firstPhotoDate: true,
      expirationExtensionDays: true,
      isHidden: true,
      deletedAt: true,
      cleanupStatus: true,
      cleanupPhotosProcessed: true,
    },
  });

  log.selectedAlbumIds = candidates.map((a) => a.id);

  for (const album of candidates) {
    if (budget.albumsRemaining <= 0) break;

    const albumLog = {
      albumId: album.id,
      status: "PROCESSING" as AlbumCleanupStatus,
      photosProcessed: 0,
      photosPurged: 0,
      photosDeleted: 0,
      externalOps: 0,
      destructiveDelete: config.destructiveDelete,
    };

    try {
      if (!isAlbumPastPurgeDate(album, now)) {
        log.skippedAlbums.push({ albumId: album.id, reason: "NOT_YET_PURGE_DATE" });
        continue;
      }

      console.info(
        "[album-cleanup] album start",
        JSON.stringify({
          albumId: album.id,
          destructiveDelete: config.destructiveDelete,
          dryRun: config.dryRun,
        })
      );

      const photos = await prisma.photo.findMany({
        where: { albumId: album.id, storageCleanupStatus: "ACTIVE" },
        orderBy: { id: "asc" },
        select: {
          id: true,
          albumId: true,
          originalKey: true,
          previewUrl: true,
          thumbWatermarkedKey: true,
          previewWatermarkedKey: true,
          storageCleanupStatus: true,
          storageDeletedAt: true,
        },
      });

      const fileKeys = photos.map((p) => p.originalKey).filter((k) => !k.startsWith("purged/"));
      if (fileKeys.length > 0 && (await hasActivePrintOrdersForFileKeys(fileKeys))) {
        await prisma.album.update({
          where: { id: album.id },
          data: {
            cleanupStatus: "BLOCKED_PRINT",
            cleanupBlockReason: "ACTIVE_PRINT_ORDER",
            cleanupLastError: null,
          },
        });
        log.skippedAlbums.push({ albumId: album.id, reason: "ACTIVE_PRINT_ORDER" });
        continue;
      }

      await prisma.album.update({
        where: { id: album.id },
        data: { cleanupStatus: "PROCESSING", cleanupStartedAt: now },
      });

      if (config.dryRun) {
        log.processedAlbums.push({
          ...albumLog,
          status: "PROCESSING",
          blockers: "DRY_RUN",
        });
        budget.albumsRemaining -= 1;
        continue;
      }

      const albumBlockers = await detectAlbumDeleteBlockers(album.id);
      const orderItemBlocked = await getPhotoOrderItemBlockers(photos.map((p) => p.id));

      console.info(
        "[album-cleanup] album blockers",
        JSON.stringify({
          albumId: album.id,
          destructiveDelete: config.destructiveDelete,
          blockers: albumBlockers.primaryReason,
          albumTableBlockers: albumBlockers.hasAlbumTableBlockers,
          photoRowBlockers: albumBlockers.hasPhotoRowBlockers,
        })
      );

      // `photos` ya viene filtrada por storageCleanupStatus = ACTIVE: las purgadas
      // en corridas anteriores no están en la lista, así que la reanudación es
      // automática y siempre se arranca en 0. cleanupPhotosProcessed es solo un
      // acumulado histórico, nunca un índice (ver resume-cursor.ts).
      const batchPlan = planPhotoBatch(album.cleanupPhotosProcessed, photos.length);

      for (let cursor = batchPlan.startIndex; cursor < photos.length; cursor += 1) {
        if (budgetExhausted(budget)) break;
        const photo = photos[cursor]!;
        const hasOrderItem = orderItemBlocked.has(photo.id);

        const purgeResult = await purgePhotoStorageAndMetadata(photo, { hasOrderItem });
        albumLog.photosProcessed += 1;
        albumLog.photosPurged += 1;
        albumLog.externalOps += purgeResult.externalOps;
        budget.photosRemaining -= 1;
        budget.externalOpsRemaining -= purgeResult.externalOps;

        if (config.destructiveDelete && !hasOrderItem) {
          const deleteResult = await deletePhotoRowIfAllowed(photo.id, false, {
            destructiveDelete: true,
          });
          if (deleteResult.deleted) {
            albumLog.photosDeleted += 1;
          } else if (deleteResult.error) {
            console.warn(
              "[album-cleanup] photo row delete skipped",
              JSON.stringify({
                albumId: album.id,
                photoId: photo.id,
                reason: deleteResult.skippedReason ?? deleteResult.error,
                errorCode: deleteResult.errorCode,
              })
            );
          }
        }

        await prisma.album.update({
          where: { id: album.id },
          data: { cleanupPhotosProcessed: nextProcessedCount(batchPlan, cursor) },
        });
      }

      const activeLeft = await prisma.photo.count({
        where: { albumId: album.id, storageCleanupStatus: "ACTIVE" },
      });

      if (activeLeft === 0) {
        albumLog.externalOps += await purgeAlbumRawUploads(album.id);
        albumLog.externalOps += await purgeAlbumCovers(album.id);
        const finalized = await finalizeAlbumCleanup(album.id, config);
        albumLog.status = finalized.status;
        log.processedAlbums.push({
          ...albumLog,
          blockers: finalized.blockers.primaryReason,
          albumTableBlockers: finalized.blockers.hasAlbumTableBlockers,
          photoRowBlockers: finalized.blockers.hasPhotoRowBlockers,
          destructiveAttempt: finalized.destructiveAttempt,
        });
      } else {
        albumLog.status = "PROCESSING";
        await prisma.album.update({
          where: { id: album.id },
          data: { cleanupStatus: "PROCESSING", cleanupLastError: null },
        });
        log.processedAlbums.push({
          ...albumLog,
          blockers: albumBlockers.primaryReason,
          albumTableBlockers: albumBlockers.hasAlbumTableBlockers,
          photoRowBlockers: albumBlockers.hasPhotoRowBlockers,
        });
      }
      log.totals.photosProcessed += albumLog.photosProcessed;
      log.totals.photosPurged += albumLog.photosPurged;
      log.totals.photosDeleted += albumLog.photosDeleted;
      log.totals.externalOps += albumLog.externalOps;
      budget.albumsRemaining -= 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        "[album-cleanup] album failed",
        JSON.stringify({
          albumId: album.id,
          destructiveDelete: config.destructiveDelete,
          stage: "album_loop",
          error: message.slice(0, 500),
        })
      );
      log.failedAlbums.push({
        albumId: album.id,
        stage: "album_loop",
        error: message.slice(0, 2000),
      });
      await prisma.album.update({
        where: { id: album.id },
        data: {
          cleanupStatus: "FAILED",
          cleanupLastError: message.slice(0, 2000),
        },
      });
      log.processedAlbums.push({
        ...albumLog,
        status: "FAILED",
        error: message.slice(0, 500),
      });
    }
  }

  log.totals.pendingAlbums = await prisma.album.count({
    where: { cleanupStatus: { in: ["PENDING", "PROCESSING"] } },
  });
  log.totals.pendingPhotos = await prisma.photo.count({
    where: {
      storageCleanupStatus: "ACTIVE",
      album: { cleanupStatus: { in: ["PENDING", "PROCESSING", "BLOCKED_PRINT"] } },
    },
  });

  log.durationMs = Date.now() - started;
  console.info("[album-cleanup] run complete", JSON.stringify(log));
  return log;
}

/** Limpieza acotada de portadas de evento y archivos de impresión (etapas legacy). */
export async function runLegacyPrintAndEventCleanup(now = new Date()): Promise<{
  deletedEventCovers: number;
  cleanedPrintOrders: number;
  deletedPrintFiles: number;
}> {
  const MS_PER_DAY = 86_400_000;
  let deletedEventCovers = 0;
  let cleanedPrintOrders = 0;
  let deletedPrintFiles = 0;

  const cutoffEvent45 = new Date(now.getTime() - 45 * MS_PER_DAY);
  const eventsToClean = await prisma.event.findMany({
    where: { coverImageKey: { not: null } },
    select: { id: true, coverImageKey: true, endsAt: true, startsAt: true },
    take: 20,
  });

  for (const ev of eventsToClean) {
    const refDate = ev.endsAt ?? ev.startsAt;
    if (!refDate || refDate > cutoffEvent45 || !ev.coverImageKey) continue;
    try {
      const key = urlToR2Key(ev.coverImageKey) ?? ev.coverImageKey;
      await deleteFromR2(key).catch(() => {});
      deletedEventCovers += 1;
    } catch {
      /* continue */
    }
    await prisma.event.update({
      where: { id: ev.id },
      data: { coverImageKey: null },
    });
  }

  const cutoffPrint = new Date(now.getTime() - 15 * MS_PER_DAY);
  const printOrdersToClean = await prisma.printOrder.findMany({
    where: {
      createdAt: { lte: cutoffPrint },
      NOT: { tags: { has: "FILES_DELETED" } },
    },
    select: { id: true, tags: true, items: { select: { fileKey: true } } },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  for (const order of printOrdersToClean) {
    try {
      for (const item of order.items) {
        try {
          const key = urlToR2Key(item.fileKey);
          await deleteFromR2(key).catch(() => {});
          deletedPrintFiles += 1;
        } catch {
          /* continue */
        }
      }
      const tags = Array.isArray(order.tags) ? order.tags : [];
      if (!tags.includes("FILES_DELETED")) {
        await prisma.printOrder.update({
          where: { id: order.id },
          data: { tags: { push: "FILES_DELETED" } },
        });
      }
      cleanedPrintOrders += 1;
    } catch {
      /* continue */
    }
  }

  return { deletedEventCovers, cleanedPrintOrders, deletedPrintFiles };
}

export async function runAlbumCleanupCron(now = new Date()) {
  const batch = await processAlbumCleanupBatch(now);
  const legacy = await runLegacyPrintAndEventCleanup(now);
  return {
    ok: true,
    ...batch,
    deletedEventCovers: legacy.deletedEventCovers,
    cleanedPrintOrders: legacy.cleanedPrintOrders,
    deletedPrintFiles: legacy.deletedPrintFiles,
  };
}
