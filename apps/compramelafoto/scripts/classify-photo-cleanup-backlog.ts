/**
 * Reporte read-only del backlog de limpieza de fotos/álbumes.
 * No borra nada.
 *
 * Uso: npx tsx scripts/classify-photo-cleanup-backlog.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const [
    totalPhotos,
    activePhotos,
    purgedPhotos,
    purgedWithRefs,
    photosHiddenAlbum,
    photosDeletedAlbum,
    photosExpiredAlbum,
    exifPending,
    exifPendingExpired,
    platformMetrics,
  ] = await Promise.all([
    prisma.photo.count(),
    prisma.photo.count({ where: { storageCleanupStatus: "ACTIVE" } }),
    prisma.photo.count({ where: { storageCleanupStatus: "STORAGE_PURGED" } }),
    prisma.photo.count({ where: { storageCleanupStatus: "PURGED_WITH_REFERENCES" } }),
    prisma.photo.count({ where: { album: { isHidden: true }, storageCleanupStatus: "ACTIVE" } }),
    prisma.photo.count({
      where: { album: { deletedAt: { not: null } }, storageCleanupStatus: "ACTIVE" },
    }),
    prisma.photo.count({
      where: {
        storageCleanupStatus: "ACTIVE",
        album: { isHidden: true, firstPhotoDate: { not: null } },
      },
    }),
    prisma.photo.count({
      where: { OR: [{ exifMetadataStatus: "PENDING" }, { exifMetadataStatus: null }] },
    }),
    prisma.photo.count({
      where: {
        OR: [{ exifMetadataStatus: "PENDING" }, { exifMetadataStatus: null }],
        album: { isHidden: true },
      },
    }),
    prisma.platformMetrics.findUnique({ where: { id: 1 } }),
  ]);

  const orderItemBlocked = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT p.id)::bigint AS count
    FROM "Photo" p
    INNER JOIN "OrderItem" oi ON oi."photoId" = p.id
    WHERE p."storageCleanupStatus" = 'ACTIVE'
  `;

  const cleanupByStatus = await prisma.album.groupBy({
    by: ["cleanupStatus"],
    _count: { id: true },
  });

  const expiredAlbums = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(DISTINCT a.id)::bigint AS count
    FROM "Album" a
    INNER JOIN "Photo" p ON p."albumId" = a.id AND p."storageCleanupStatus" = 'ACTIVE'
    WHERE a."isHidden" = true
      AND a."firstPhotoDate" IS NOT NULL
      AND (a."firstPhotoDate" + ((45 + COALESCE(a."expirationExtensionDays", 0)) || ' days')::interval) <= NOW()
  `;

  const purgedButKeysLookActive = await prisma.photo.count({
    where: {
      storageDeletedAt: { not: null },
      originalKey: { not: { startsWith: "purged/" } },
    },
  });

  const metadataWithoutStorage = await prisma.photo.count({
    where: {
      storageDeletedAt: null,
      metadataDeletedAt: { not: null },
    },
  });

  console.log("=== CLASSIFY PHOTO CLEANUP BACKLOG ===");
  console.log(JSON.stringify({
    generatedAt: now.toISOString(),
    photos: {
      totalInDb: totalPhotos,
      active: activePhotos,
      storagePurged: purgedPhotos,
      purgedWithOrderReferences: purgedWithRefs,
      inHiddenAlbums: photosHiddenAlbum,
      inSoftDeletedAlbums: photosDeletedAlbum,
      inHiddenAlbumsAll: photosExpiredAlbum,
      blockedByOrderItem: Number(orderItemBlocked[0]?.count ?? 0),
      purgedButLegacyKeys: purgedButKeysLookActive,
      metadataWithoutStorage,
    },
    exif: {
      pending: exifPending,
      pendingInHiddenAlbums: exifPendingExpired,
    },
    albums: {
      expiredWithActivePhotos: Number(expiredAlbums[0]?.count ?? 0),
      cleanupByStatus: cleanupByStatus.map((r) => ({
        status: r.cleanupStatus,
        count: r._count.id,
      })),
    },
    platform: {
      photosUploadedTotal: platformMetrics
        ? Number(platformMetrics.photosUploadedTotal)
        : null,
    },
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
