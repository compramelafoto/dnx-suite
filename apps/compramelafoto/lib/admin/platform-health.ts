import { prisma } from "@/lib/prisma";
import { getPhotosUploadedTotal } from "@/lib/platform-metrics";
import { getAlbumCleanupConfig } from "@/lib/album-cleanup/config";
import { pendingExifPhotoWhere } from "@/lib/photographic-equipment/pending-photos";
import { getExifDeviceScanLease } from "@/lib/photographic-equipment/scan-lease";

const MS_PER_DAY = 86_400_000;
const AVG_PHOTO_BYTES = 4.5 * 1024 * 1024;

export type DailyCount = { date: string; count: number };

export type PlatformHealthAlert = {
  id: string;
  severity: "warning" | "critical";
  message: string;
  href?: string;
};

export type PlatformHealthSnapshot = {
  generatedAt: string;
  durationMs: number;
  cleanup: {
    config: {
      destructiveDelete: boolean;
      dryRun: boolean;
      enabled: boolean;
    };
    albumsByStatus: Record<string, number>;
    blockedByReferences: number;
    photosPurged: number;
    photosActive: number;
    photosByStorageStatus: Record<string, number>;
    progressPercent: number;
    lastRunAt: string | null;
    avgDurationMs: number | null;
  };
  exif: {
    byStatus: Record<string, number>;
    pending: number;
    progressPercent: number;
    avgPerHour24h: number | null;
    lastRunAt: string | null;
  };
  equipment: {
    photosAnalyzed: number;
    camerasDetected: number;
    lensesDetected: number;
    pending: number;
    skippedExpired: number;
    topCameras: Array<{ label: string; count: number }>;
    topLenses: Array<{ label: string; count: number }>;
  };
  ftp: {
    workerStatus: "ok" | "degraded" | "offline" | "unknown";
    lastHeartbeatAt: string | null;
    enabledConnections: number;
    receivedToday: number;
    processedToday: number;
    rejectedToday: number;
    errorsToday: number;
    queuePending: number;
    queueProcessing: number;
    queueFailed: number;
  };
  zip: {
    byStatus: Record<string, number>;
    avgDurationMs: number | null;
    stuckOver1h: number;
  };
  ai: {
    ocrCompleted: number;
    ocrPending: number;
    ocrFailed: number;
    facesPending: number;
    facesCompleted: number;
    embeddingsPending: number;
    embeddingsCompleted: number;
    analysisJobsByStatus: Record<string, number>;
  };
  storage: {
    photosTotalHistorical: number;
    photosActive: number;
    photosPurged: number;
    photosDeletedEstimate: number;
    storageFreedGb: number;
    storageOccupiedEstimateGb: number;
    missingFilePhotos: number;
    orphanPhotos: number;
  };
  alerts: PlatformHealthAlert[];
  charts: {
    albumsCleanedPerDay: DailyCount[];
    photosPurgedPerDay: DailyCount[];
    photosUploadedPerDay: DailyCount[];
    exifProcessedPerDay: DailyCount[];
    errorsPerDay: DailyCount[];
  };
  links: {
    cleanupAlbums: string;
    exifQueue: string;
    ftpIngest: string;
    zipJobs: string;
    aiPanel: string;
    r2Storage: string;
  };
};

function mapGroupBy<T extends string>(
  rows: Array<{ [K in T]: string } & { _count: { _all: number } }>,
  key: T
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[String(row[key])] = row._count._all;
  }
  return out;
}

function fillDailySeries(
  rows: Array<{ day: Date; count: bigint | number }>,
  days = 30
): DailyCount[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = row.day.toISOString().slice(0, 10);
    map.set(key, Number(row.count));
  }
  const result: DailyCount[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * MS_PER_DAY);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, count: map.get(key) ?? 0 });
  }
  return result;
}

function progressPercent(done: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round((done / total) * 100);
}

export async function loadPlatformHealthSnapshot(): Promise<PlatformHealthSnapshot> {
  const started = Date.now();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const day24hAgo = new Date(now.getTime() - 24 * MS_PER_DAY);
  const day30Ago = new Date(now.getTime() - 30 * MS_PER_DAY);
  const staleProcessingCutoff = new Date(now.getTime() - 30 * 60 * 1000);
  const zipStuckCutoff = new Date(now.getTime() - 60 * 60 * 1000);

  const cleanupConfig = getAlbumCleanupConfig();

  const [
    albumCleanupGrouped,
    photoStorageGrouped,
    exifGrouped,
    zipGrouped,
    analysisJobGrouped,
    photoAnalysisGrouped,
    ingestGrouped,
    photosPurgedCount,
    photosActiveCount,
    photosTotalHistorical,
    exifPendingEligible,
    exifSkippedExpired,
    equipmentCameras,
    equipmentLenses,
    topCameraRows,
    topLensRows,
    ocrPhotoCount,
    facePhotoCount,
    facesTotal,
    enabledFtpConnections,
    lastFtpHeartbeat,
    uploadLogsToday,
    ingestTodayGrouped,
    zipStuckCount,
    zipAvgDuration,
    cleanupLastRun,
    cleanupAvgDuration,
    exifLastRun,
    exifAnalyzed24h,
    missingFilePhotos,
    orphanPhotos,
    blockedByReferencesAlbums,
    staleProcessingAlbums,
    exifLease,
    chartsRaw,
  ] = await Promise.all([
    prisma.album.groupBy({
      by: ["cleanupStatus"],
      _count: { _all: true },
    }),
    prisma.photo.groupBy({
      by: ["storageCleanupStatus"],
      _count: { _all: true },
    }),
    prisma.photo.groupBy({
      by: ["exifMetadataStatus"],
      _count: { _all: true },
    }),
    prisma.zipGenerationJob.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.photoAnalysisJob.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.photo.groupBy({
      by: ["analysisStatus"],
      where: { isRemoved: false, storageCleanupStatus: "ACTIVE" },
      _count: { _all: true },
    }),
    prisma.cameraIngestJob.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.photo.count({
      where: {
        storageCleanupStatus: { in: ["STORAGE_PURGED", "PURGED_WITH_REFERENCES"] },
      },
    }),
    prisma.photo.count({ where: { storageCleanupStatus: "ACTIVE", isRemoved: false } }),
    getPhotosUploadedTotal(),
    prisma.photo.count({ where: pendingExifPhotoWhere }),
    prisma.photo.count({ where: { exifMetadataStatus: "SKIPPED_EXPIRED" } }),
    prisma.photographerDevice.count({ where: { deviceType: "CAMERA" } }),
    prisma.photographerDevice.count({
      where: { OR: [{ lensModel: { not: null } }, { lensBrand: { not: null } }] },
    }),
    prisma.photographerDevice.findMany({
      orderBy: { photoCount: "desc" },
      take: 10,
      select: { brand: true, model: true, photoCount: true },
    }),
    prisma.photographerDevice.findMany({
      where: { lensModel: { not: null } },
      orderBy: { photoCount: "desc" },
      take: 10,
      select: { lensBrand: true, lensModel: true, photoCount: true },
    }),
    prisma.ocrToken
      .groupBy({ by: ["photoId"], _count: { _all: true } })
      .then((r) => r.length),
    prisma.faceDetection
      .groupBy({ by: ["photoId"], _count: { _all: true } })
      .then((r) => r.length),
    prisma.faceDetection.count(),
    prisma.cameraConnectionSettings.count({ where: { enabled: true } }),
    prisma.cameraConnectionSettings.findFirst({
      where: { lastUploadAt: { not: null } },
      orderBy: { lastUploadAt: "desc" },
      select: { lastUploadAt: true },
    }),
    prisma.cameraUploadLog.groupBy({
      by: ["status"],
      where: { createdAt: { gte: todayStart } },
      _count: { _all: true },
    }),
    prisma.cameraIngestJob.groupBy({
      by: ["status"],
      where: { updatedAt: { gte: todayStart } },
      _count: { _all: true },
    }),
    prisma.zipGenerationJob.count({
      where: { status: "PROCESSING", startedAt: { lte: zipStuckCutoff } },
    }),
    prisma.$queryRaw<Array<{ avg_ms: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM ("finishedAt" - "startedAt")) * 1000)::float AS avg_ms
      FROM "ZipGenerationJob"
      WHERE status = 'COMPLETED'
        AND "finishedAt" IS NOT NULL
        AND "startedAt" IS NOT NULL
        AND "finishedAt" >= ${day24hAgo}
    `,
    prisma.album.findFirst({
      where: { cleanupStartedAt: { not: null } },
      orderBy: { cleanupStartedAt: "desc" },
      select: { cleanupStartedAt: true },
    }),
    prisma.$queryRaw<Array<{ avg_ms: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM ("cleanupCompletedAt" - "cleanupStartedAt")) * 1000)::float AS avg_ms
      FROM "Album"
      WHERE "cleanupCompletedAt" IS NOT NULL
        AND "cleanupStartedAt" IS NOT NULL
        AND "cleanupCompletedAt" >= ${day24hAgo}
    `,
    prisma.photo.findFirst({
      where: { exifMetadataAnalyzedAt: { not: null } },
      orderBy: { exifMetadataAnalyzedAt: "desc" },
      select: { exifMetadataAnalyzedAt: true },
    }),
    prisma.photo.count({
      where: {
        exifMetadataStatus: "ANALYZED",
        exifMetadataAnalyzedAt: { gte: day24hAgo },
      },
    }),
    prisma.photo.count({
      where: {
        storageCleanupStatus: "ACTIVE",
        OR: [
          { originalKey: { startsWith: "purged/" } },
          { previewUrl: { contains: "purged/photo-" } },
        ],
      },
    }),
    prisma.photo.count({
      where: {
        storageCleanupStatus: "ACTIVE",
        album: { OR: [{ deletedAt: { not: null } }, { isHidden: true }] },
      },
    }),
    prisma.album.count({
      where: {
        cleanupBlockReason: { not: null },
        cleanupStatus: { in: ["PENDING", "PROCESSING", "BLOCKED_PRINT", "FAILED"] },
      },
    }),
    prisma.album.count({
      where: {
        cleanupStatus: "PROCESSING",
        cleanupStartedAt: { lte: staleProcessingCutoff },
      },
    }),
    getExifDeviceScanLease(),
    Promise.all([
      prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT DATE("cleanupCompletedAt") AS day, COUNT(*)::bigint AS count
        FROM "Album"
        WHERE "cleanupCompletedAt" >= ${day30Ago}
          AND "cleanupStatus" IN ('COMPLETED', 'COMPLETED_WITH_REFERENCES')
        GROUP BY 1 ORDER BY 1
      `,
      prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT DATE("storageDeletedAt") AS day, COUNT(*)::bigint AS count
        FROM "Photo"
        WHERE "storageDeletedAt" >= ${day30Ago}
        GROUP BY 1 ORDER BY 1
      `,
      prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT DATE("createdAt") AS day, COUNT(*)::bigint AS count
        FROM "Photo"
        WHERE "createdAt" >= ${day30Ago}
        GROUP BY 1 ORDER BY 1
      `,
      prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT DATE("exifMetadataAnalyzedAt") AS day, COUNT(*)::bigint AS count
        FROM "Photo"
        WHERE "exifMetadataAnalyzedAt" >= ${day30Ago}
          AND "exifMetadataStatus" IN ('ANALYZED', 'NO_EXIF', 'SKIPPED_EXPIRED')
        GROUP BY 1 ORDER BY 1
      `,
      prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT day, SUM(cnt)::bigint AS count FROM (
          SELECT DATE("cleanupCompletedAt") AS day, COUNT(*) AS cnt
          FROM "Album"
          WHERE "cleanupStatus" = 'FAILED' AND "cleanupCompletedAt" >= ${day30Ago}
          GROUP BY 1
          UNION ALL
          SELECT DATE("updatedAt") AS day, COUNT(*) AS cnt
          FROM "PhotoAnalysisJob"
          WHERE status = 'ERROR' AND "updatedAt" >= ${day30Ago}
          GROUP BY 1
          UNION ALL
          SELECT DATE("finishedAt") AS day, COUNT(*) AS cnt
          FROM "ZipGenerationJob"
          WHERE status = 'FAILED' AND "finishedAt" >= ${day30Ago}
          GROUP BY 1
        ) errors GROUP BY day ORDER BY day
      `,
    ]),
  ]);

  const albumsByStatus = mapGroupBy(albumCleanupGrouped, "cleanupStatus");
  const photosByStorageStatus = mapGroupBy(photoStorageGrouped, "storageCleanupStatus");
  const exifByStatusRaw = mapGroupBy(
    exifGrouped.map((r) => ({
      exifMetadataStatus: r.exifMetadataStatus ?? "PENDING",
      _count: r._count,
    })),
    "exifMetadataStatus"
  );
  const exifByStatus = exifByStatusRaw;
  const zipByStatus = mapGroupBy(zipGrouped, "status");
  const analysisJobsByStatus = mapGroupBy(analysisJobGrouped, "status");
  const photoAnalysisByStatus = mapGroupBy(photoAnalysisGrouped, "analysisStatus");
  const ingestByStatus = mapGroupBy(ingestGrouped, "status");

  const uploadTodayMap = mapGroupBy(uploadLogsToday, "status");
  const ingestTodayMap = mapGroupBy(ingestTodayGrouped, "status");

  const cleanupPending =
    (albumsByStatus.PENDING ?? 0) +
    (albumsByStatus.PROCESSING ?? 0) +
    (albumsByStatus.BLOCKED_PRINT ?? 0) +
    (albumsByStatus.FAILED ?? 0);
  const cleanupDone =
    (albumsByStatus.COMPLETED ?? 0) + (albumsByStatus.COMPLETED_WITH_REFERENCES ?? 0);
  const cleanupTotal = cleanupPending + cleanupDone;

  const exifPending = exifByStatus.PENDING ?? 0;
  const exifDone =
    (exifByStatus.ANALYZED ?? 0) +
    (exifByStatus.NO_EXIF ?? 0) +
    (exifByStatus.SKIPPED_EXPIRED ?? 0) +
    (exifByStatus.FAILED ?? 0);
  const exifTotal = exifPending + exifDone;

  const ingestPending = ingestByStatus.PENDING ?? 0;
  const ingestProcessing = ingestByStatus.PROCESSING ?? 0;
  const ingestFailed = ingestByStatus.FAILED ?? 0;

  const lastHeartbeat = lastFtpHeartbeat?.lastUploadAt ?? null;
  let ftpWorkerStatus: PlatformHealthSnapshot["ftp"]["workerStatus"] = "unknown";
  if (enabledFtpConnections === 0) {
    ftpWorkerStatus = "unknown";
  } else if (!lastHeartbeat) {
    ftpWorkerStatus = "offline";
  } else if (now.getTime() - lastHeartbeat.getTime() > 30 * 60 * 1000) {
    ftpWorkerStatus = "degraded";
  } else if (ingestProcessing > 0 && ingestPending > 50) {
    ftpWorkerStatus = "degraded";
  } else {
    ftpWorkerStatus = "ok";
  }

  const alerts: PlatformHealthAlert[] = [];

  const failedAlbums = albumsByStatus.FAILED ?? 0;
  if (failedAlbums > 0) {
    alerts.push({
      id: "albums-failed",
      severity: "critical",
      message: `Hay ${failedAlbums} álbumes en FAILED`,
      href: "/admin/salud-plataforma#cleanup",
    });
  }

  if (exifPending > 500) {
    alerts.push({
      id: "exif-pending",
      severity: exifPending > 2000 ? "critical" : "warning",
      message: `Hay ${exifPending.toLocaleString("es-AR")} fotos pendientes de EXIF`,
      href: "/admin/equipos-fotograficos",
    });
  }

  if (ftpWorkerStatus === "offline" && enabledFtpConnections > 0) {
    alerts.push({
      id: "ftp-offline",
      severity: "critical",
      message: "El worker FTP no responde (sin actividad reciente)",
      href: "/admin/procesamiento-fotos",
    });
  } else if (ftpWorkerStatus === "degraded") {
    alerts.push({
      id: "ftp-degraded",
      severity: "warning",
      message: "El worker FTP está degradado o con cola alta",
      href: "/admin/procesamiento-fotos",
    });
  }

  if (zipStuckCount > 0) {
    alerts.push({
      id: "zip-stuck",
      severity: "critical",
      message: `Hay ${zipStuckCount} ZIP trabados hace más de 1 hora`,
      href: "/admin/salud-plataforma#zip",
    });
  }

  if (staleProcessingAlbums > 0) {
    alerts.push({
      id: "albums-stale-processing",
      severity: "warning",
      message: `Hay ${staleProcessingAlbums} álbumes en PROCESSING hace más de 30 minutos`,
      href: "/admin/salud-plataforma#cleanup",
    });
  }

  const analysisPending = analysisJobsByStatus.PENDING ?? 0;
  if (analysisPending > 1000) {
    alerts.push({
      id: "ai-pending",
      severity: "warning",
      message: `Hay ${analysisPending.toLocaleString("es-AR")} trabajos de IA pendientes`,
      href: "/admin/ia",
    });
  }

  const photosDeletedEstimate = Math.max(
    0,
    photosTotalHistorical - photosActiveCount - photosPurgedCount
  );

  const [
    albumsCleanedPerDay,
    photosPurgedPerDay,
    photosUploadedPerDay,
    exifProcessedPerDay,
    errorsPerDay,
  ] = chartsRaw;

  return {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    cleanup: {
      config: {
        destructiveDelete: cleanupConfig.destructiveDelete,
        dryRun: cleanupConfig.dryRun,
        enabled: cleanupConfig.enabled,
      },
      albumsByStatus,
      blockedByReferences: blockedByReferencesAlbums,
      photosPurged: photosPurgedCount,
      photosActive: photosActiveCount,
      photosByStorageStatus,
      progressPercent: progressPercent(cleanupDone, cleanupTotal),
      lastRunAt: cleanupLastRun?.cleanupStartedAt?.toISOString() ?? null,
      avgDurationMs: cleanupAvgDuration[0]?.avg_ms ?? null,
    },
    exif: {
      byStatus: exifByStatus,
      pending: exifPendingEligible,
      progressPercent: progressPercent(exifDone, exifTotal),
      avgPerHour24h: exifAnalyzed24h > 0 ? Math.round(exifAnalyzed24h / 24) : null,
      lastRunAt:
        exifLease?.lockedAt ??
        exifLastRun?.exifMetadataAnalyzedAt?.toISOString() ??
        null,
    },
    equipment: {
      photosAnalyzed: (exifByStatus.ANALYZED ?? 0) + (exifByStatus.NO_EXIF ?? 0),
      camerasDetected: equipmentCameras,
      lensesDetected: equipmentLenses,
      pending: exifPendingEligible,
      skippedExpired: exifSkippedExpired,
      topCameras: topCameraRows.map((d) => ({
        label: `${d.brand} ${d.model}`.trim(),
        count: d.photoCount,
      })),
      topLenses: topLensRows.map((d) => ({
        label: [d.lensBrand, d.lensModel].filter(Boolean).join(" ") || "—",
        count: d.photoCount,
      })),
    },
    ftp: {
      workerStatus: ftpWorkerStatus,
      lastHeartbeatAt: lastHeartbeat?.toISOString() ?? null,
      enabledConnections: enabledFtpConnections,
      receivedToday:
        (uploadTodayMap.RECEIVED ?? 0) +
        (uploadTodayMap.PROCESSING ?? 0) +
        (uploadTodayMap.SUCCESS ?? 0),
      processedToday: ingestTodayMap.COMPLETED ?? 0,
      rejectedToday:
        (uploadTodayMap.REJECTED ?? 0) +
        (uploadTodayMap.FAILED ?? 0) +
        (uploadTodayMap.NO_ACTIVE_ALBUM ?? 0),
      errorsToday:
        (uploadTodayMap.FAILED ?? 0) + (ingestTodayMap.FAILED ?? 0),
      queuePending: ingestPending,
      queueProcessing: ingestProcessing,
      queueFailed: ingestFailed,
    },
    zip: {
      byStatus: zipByStatus,
      avgDurationMs: zipAvgDuration[0]?.avg_ms ?? null,
      stuckOver1h: zipStuckCount,
    },
    ai: {
      ocrCompleted: ocrPhotoCount,
      ocrPending: photoAnalysisByStatus.PENDING ?? 0,
      ocrFailed: photoAnalysisByStatus.ERROR ?? 0,
      facesPending: Math.max(
        0,
        photosActiveCount - facePhotoCount - (photoAnalysisByStatus.DONE ?? 0)
      ),
      facesCompleted: facePhotoCount,
      embeddingsPending: analysisJobsByStatus.PENDING ?? 0,
      embeddingsCompleted: facesTotal,
      analysisJobsByStatus,
    },
    storage: {
      photosTotalHistorical,
      photosActive: photosActiveCount,
      photosPurged: photosPurgedCount,
      photosDeletedEstimate,
      storageFreedGb: Math.round(((photosPurgedCount * AVG_PHOTO_BYTES) / 1e9) * 100) / 100,
      storageOccupiedEstimateGb:
        Math.round(((photosActiveCount * AVG_PHOTO_BYTES) / 1e9) * 100) / 100,
      missingFilePhotos,
      orphanPhotos,
    },
    alerts,
    charts: {
      albumsCleanedPerDay: fillDailySeries(albumsCleanedPerDay),
      photosPurgedPerDay: fillDailySeries(photosPurgedPerDay),
      photosUploadedPerDay: fillDailySeries(photosUploadedPerDay),
      exifProcessedPerDay: fillDailySeries(exifProcessedPerDay),
      errorsPerDay: fillDailySeries(errorsPerDay),
    },
    links: {
      cleanupAlbums: "/admin/albums?visibility=private",
      exifQueue: "/admin/equipos-fotograficos",
      ftpIngest: "/admin/procesamiento-fotos",
      zipJobs: "/admin/pedidos",
      aiPanel: "/admin/ia",
      r2Storage: "/admin/r2",
    },
  };
}
