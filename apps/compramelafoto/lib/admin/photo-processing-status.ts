import { prisma } from "@/lib/prisma";
import { getPhotosUploadedTotal } from "@/lib/platform-metrics";
import {
  isAsyncAlbumPhotoIngestEnabled,
  isAsyncAlbumPhotoIngestEnabledClient,
} from "@/lib/albums/album-photo-ingest-feature-flag";

const INGEST_STATUSES = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] as const;
const ANALYSIS_STATUSES = ["PENDING", "PROCESSING", "DONE", "ERROR"] as const;

export type IngestStatusKey = (typeof INGEST_STATUSES)[number];
export type AnalysisStatusKey = (typeof ANALYSIS_STATUSES)[number];

export type PhotoProcessingAlbumBacklogRow = {
  albumId: number;
  title: string;
  publicSlug: string | null;
  photographerName: string | null;
  pending: number;
  processing: number;
  failed: number;
  totalActive: number;
  oldestPendingAt: string | null;
};

export type PhotoProcessingFailedIngestRow = {
  id: string;
  albumId: number;
  albumTitle: string;
  source: string;
  originalFilename: string | null;
  attempts: number;
  lastError: string | null;
  updatedAt: string;
};

export type PhotoProcessingDashboardSnapshot = {
  generatedAt: string;
  config: {
    asyncIngestServer: boolean;
    asyncIngestClient: boolean;
  };
  ingest: {
    byStatus: Record<IngestStatusKey, number>;
    bySource: Record<string, number>;
    backlogTotal: number;
    stalledProcessing: number;
    oldestPending: {
      id: string;
      albumId: number;
      albumTitle: string;
      createdAt: string;
      waitMinutes: number;
    } | null;
    albumBacklog: PhotoProcessingAlbumBacklogRow[];
    recentFailed: PhotoProcessingFailedIngestRow[];
  };
  analysis: {
    /** Histórico de fotos subidas (no decrece al purgar). */
    totalPhotos: number;
    activePhotosInDb: number;
    photosByStatus: Record<AnalysisStatusKey, number>;
    jobsByStatus: Record<AnalysisStatusKey, number>;
    photosWithoutJob: number;
    progressPercent: number;
  };
};

function emptyIngestCounts(): Record<IngestStatusKey, number> {
  return { PENDING: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0 };
}

function emptyAnalysisCounts(): Record<AnalysisStatusKey, number> {
  return { PENDING: 0, PROCESSING: 0, DONE: 0, ERROR: 0 };
}

export async function loadPhotoProcessingDashboardSnapshot(): Promise<PhotoProcessingDashboardSnapshot> {
  const now = Date.now();
  const staleCutoff = new Date(now - 30 * 60 * 1000);

  const [
    ingestGrouped,
    ingestBySource,
    oldestPending,
    stalledProcessing,
    recentFailedJobs,
    albumStatusGrouped,
    totalPhotosUploaded,
    activePhotosInDb,
    photosByAnalysisStatus,
    analysisJobsGrouped,
    photosWithoutJob,
  ] = await Promise.all([
    prisma.cameraIngestJob.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.cameraIngestJob.groupBy({
      by: ["source"],
      _count: { _all: true },
    }),
    prisma.cameraIngestJob.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        albumId: true,
        createdAt: true,
        album: { select: { title: true } },
      },
    }),
    prisma.cameraIngestJob.count({
      where: { status: "PROCESSING", lockedAt: { lt: staleCutoff } },
    }),
    prisma.cameraIngestJob.findMany({
      where: { status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: {
        id: true,
        albumId: true,
        source: true,
        originalFilename: true,
        attempts: true,
        lastError: true,
        updatedAt: true,
        album: { select: { title: true } },
      },
    }),
    prisma.cameraIngestJob.groupBy({
      by: ["albumId", "status"],
      where: { status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
      _count: { _all: true },
    }),
    getPhotosUploadedTotal(),
    prisma.photo.count({ where: { isRemoved: false, storageCleanupStatus: "ACTIVE" } }),
    prisma.photo.groupBy({
      by: ["analysisStatus"],
      where: { isRemoved: false },
      _count: { _all: true },
    }),
    prisma.photoAnalysisJob.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.photo.count({
      where: { isRemoved: false, analysisJob: null },
    }),
  ]);

  const byStatus = emptyIngestCounts();
  for (const row of ingestGrouped) {
    const key = row.status as IngestStatusKey;
    if (key in byStatus) byStatus[key] = row._count._all;
  }

  const bySource: Record<string, number> = {};
  for (const row of ingestBySource) {
    bySource[row.source] = row._count._all;
  }

  const backlogTotal = byStatus.PENDING + byStatus.PROCESSING;

  const albumMap = new Map<
    number,
    { pending: number; processing: number; failed: number }
  >();
  for (const row of albumStatusGrouped) {
    const current = albumMap.get(row.albumId) ?? { pending: 0, processing: 0, failed: 0 };
    if (row.status === "PENDING") current.pending = row._count._all;
    if (row.status === "PROCESSING") current.processing = row._count._all;
    if (row.status === "FAILED") current.failed = row._count._all;
    albumMap.set(row.albumId, current);
  }

  const albumIds = [...albumMap.keys()];
  const albums =
    albumIds.length > 0
      ? await prisma.album.findMany({
          where: { id: { in: albumIds } },
          select: {
            id: true,
            title: true,
            publicSlug: true,
            user: { select: { name: true } },
          },
        })
      : [];

  const oldestPendingPerAlbum =
    albumIds.length > 0
      ? await prisma.cameraIngestJob.groupBy({
          by: ["albumId"],
          where: { albumId: { in: albumIds }, status: "PENDING" },
          _min: { createdAt: true },
        })
      : [];

  const oldestPendingByAlbum = new Map(
    oldestPendingPerAlbum.map((row) => [row.albumId, row._min.createdAt])
  );

  const albumBacklog: PhotoProcessingAlbumBacklogRow[] = albums
    .map((album) => {
      const counts = albumMap.get(album.id) ?? { pending: 0, processing: 0, failed: 0 };
      const oldest = oldestPendingByAlbum.get(album.id);
      return {
        albumId: album.id,
        title: album.title,
        publicSlug: album.publicSlug,
        photographerName: album.user?.name ?? null,
        pending: counts.pending,
        processing: counts.processing,
        failed: counts.failed,
        totalActive: counts.pending + counts.processing,
        oldestPendingAt: oldest ? oldest.toISOString() : null,
      };
    })
    .filter((row) => row.pending + row.processing + row.failed > 0)
    .sort((a, b) => b.totalActive - a.totalActive || b.failed - a.failed)
    .slice(0, 20);

  const photosByStatus = emptyAnalysisCounts();
  for (const row of photosByAnalysisStatus) {
    const key = row.analysisStatus as AnalysisStatusKey;
    if (key in photosByStatus) photosByStatus[key] = row._count._all;
  }

  const jobsByStatus = emptyAnalysisCounts();
  for (const row of analysisJobsGrouped) {
    const key = row.status as AnalysisStatusKey;
    if (key in jobsByStatus) jobsByStatus[key] = row._count._all;
  }

  const analysisDone = photosByStatus.DONE;
  const progressPercent =
    activePhotosInDb > 0 ? Math.round((analysisDone / activePhotosInDb) * 100) : 0;

  return {
    generatedAt: new Date(now).toISOString(),
    config: {
      asyncIngestServer: isAsyncAlbumPhotoIngestEnabled(),
      asyncIngestClient: isAsyncAlbumPhotoIngestEnabledClient(),
    },
    ingest: {
      byStatus,
      bySource,
      backlogTotal,
      stalledProcessing,
      oldestPending: oldestPending
        ? {
            id: oldestPending.id,
            albumId: oldestPending.albumId,
            albumTitle: oldestPending.album.title,
            createdAt: oldestPending.createdAt.toISOString(),
            waitMinutes: Math.max(
              0,
              Math.round((now - oldestPending.createdAt.getTime()) / 60_000)
            ),
          }
        : null,
      albumBacklog,
      recentFailed: recentFailedJobs.map((job) => ({
        id: job.id,
        albumId: job.albumId,
        albumTitle: job.album.title,
        source: job.source,
        originalFilename: job.originalFilename,
        attempts: job.attempts,
        lastError: job.lastError,
        updatedAt: job.updatedAt.toISOString(),
      })),
    },
    analysis: {
      totalPhotos: totalPhotosUploaded,
      activePhotosInDb,
      photosByStatus,
      jobsByStatus,
      photosWithoutJob,
      progressPercent,
    },
  };
}
