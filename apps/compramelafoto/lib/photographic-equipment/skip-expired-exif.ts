import { prisma } from "@/lib/prisma";
import { isAlbumPastPurgeDate } from "@/lib/album-cleanup/eligibility";

/**
 * Marca fotos de álbumes vencidos/ocultos/en cleanup como SKIPPED_EXPIRED
 * para vaciar el backlog EXIF sin leer R2.
 */
export async function skipExpiredExifBacklog(batchSize = 500): Promise<number> {
  const photos = await prisma.photo.findMany({
    where: {
      OR: [{ exifMetadataStatus: "PENDING" }, { exifMetadataStatus: null }],
      NOT: { exifMetadataStatus: "SKIPPED_EXPIRED" },
    },
    orderBy: { id: "asc" },
    take: batchSize,
    select: {
      id: true,
      album: {
        select: {
          firstPhotoDate: true,
          expirationExtensionDays: true,
          isHidden: true,
          deletedAt: true,
          cleanupStatus: true,
        },
      },
    },
  });

  let skipped = 0;
  const now = new Date();

  for (const photo of photos) {
    const album = photo.album;
    const shouldSkip =
      album.deletedAt != null ||
      album.isHidden ||
      isAlbumPastPurgeDate(album, now) ||
      album.cleanupStatus === "PENDING" ||
      album.cleanupStatus === "PROCESSING" ||
      album.cleanupStatus === "COMPLETED" ||
      album.cleanupStatus === "COMPLETED_WITH_REFERENCES" ||
      album.cleanupStatus === "BLOCKED_PRINT";

    if (!shouldSkip) continue;

    await prisma.photo.update({
      where: { id: photo.id },
      data: {
        exifMetadataStatus: "SKIPPED_EXPIRED",
        exifMetadataAnalyzedAt: now,
      },
    });
    skipped += 1;
  }

  return skipped;
}
