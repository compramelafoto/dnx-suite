/**
 * Reconciliación comercial de fotos editoriales vs álbumes CLF.
 */

import { prisma } from "@repo/db";
import { getClfReadonlyClient, probeClfReadonlyConnection } from "../clf-readonly-db";
import { resolveEditorialCommercialFromAlbum } from "./commercial";

export async function reconcileEditorialPhotoCommercialStatus(options?: {
  take?: number;
}): Promise<{ ok: boolean; updated: number; error?: string }> {
  const probe = await probeClfReadonlyConnection();
  if (!probe.ok) {
    return { ok: false, updated: 0, error: probe.error || "CLF read-only no disponible" };
  }

  const take = options?.take ?? 100;
  const photos = await prisma.infoSpotEditorialPhoto.findMany({
    where: { editorialUsageStatus: "ACTIVE" },
    orderBy: { lastSyncedAt: "asc" },
    take,
  });

  const clf = getClfReadonlyClient();
  let updated = 0;

  for (const photo of photos) {
    const albumId = Number(photo.sourceAlbumExternalId);
    if (!Number.isFinite(albumId)) continue;

    const album = await clf.album.findUnique({
      where: { id: albumId },
      select: {
        publicSlug: true,
        isPublic: true,
        isHidden: true,
        deletedAt: true,
        firstPhotoDate: true,
        createdAt: true,
        expirationExtensionDays: true,
        cleanupStatus: true,
      },
    });

    if (!album || album.deletedAt) {
      await prisma.infoSpotEditorialPhoto.update({
        where: { id: photo.id },
        data: {
          commercialStatus: "DELETED",
          purchaseUrl: null,
          albumUrl: null,
          lastSyncedAt: new Date(),
          processStatus:
            photo.editorialLicenseStatus === "AUTHORIZED"
              ? photo.processStatus
              : "UNAVAILABLE",
        },
      });
      updated += 1;
      continue;
    }

    const commercial = resolveEditorialCommercialFromAlbum(album);
    await prisma.infoSpotEditorialPhoto.update({
      where: { id: photo.id },
      data: {
        commercialStatus: commercial.status,
        albumUrl: commercial.albumUrl,
        purchaseUrl: commercial.purchaseUrl,
        lastSyncedAt: new Date(),
      },
    });
    updated += 1;
  }

  return { ok: true, updated };
}
