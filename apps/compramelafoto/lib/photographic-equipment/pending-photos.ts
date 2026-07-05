import type { Prisma } from "@/lib/prisma";

/**
 * Fotos elegibles para escaneo EXIF de equipos.
 * Excluye álbumes ocultos, eliminados, en cleanup o vencidos.
 */
export const pendingExifPhotoWhere: Prisma.PhotoWhereInput = {
  isRemoved: false,
  storageDeletedAt: null,
  storageCleanupStatus: "ACTIVE",
  OR: [{ exifMetadataStatus: "PENDING" }, { exifMetadataStatus: null }],
  album: {
    deletedAt: null,
    isHidden: false,
    cleanupStatus: { in: ["NONE", "FAILED"] },
  },
};
