import { prisma } from "@/lib/prisma";

/**
 * Al activar fotos ocultas, encola análisis facial para fotos del álbum sin job.
 */
export async function ensureAlbumPhotosQueuedForHiddenMode(albumId: number): Promise<number> {
  if (!Number.isFinite(albumId)) return 0;

  const photos = await prisma.photo.findMany({
    where: { albumId, isRemoved: false },
    select: {
      id: true,
      analysisStatus: true,
      analysisJob: { select: { id: true } },
    },
  });

  const needsJob = photos.filter((p) => !p.analysisJob);
  if (needsJob.length === 0) return 0;

  const photoIds = needsJob.map((p) => p.id);
  await prisma.photoAnalysisJob.createMany({
    data: photoIds.map((photoId) => ({ photoId, status: "PENDING" })),
    skipDuplicates: true,
  });
  await prisma.photo.updateMany({
    where: { id: { in: photoIds } },
    data: { analysisStatus: "PENDING", analysisError: null },
  });

  return photoIds.length;
}
