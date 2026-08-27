/**
 * Lectura de álbumes públicos CLF → snapshots de cobertura.
 */

import { getClfReadonlyClient, probeClfReadonlyConnection } from "@repo/db";
import type { CoverageAlbumSnapshot, CoveragePhotographerInput } from "./types";

function displayName(user: { name: string | null; email: string } | null | undefined): string {
  if (!user) return "Fotógrafo";
  return user.name?.trim() || user.email;
}

const photographerUserSelect = {
  id: true,
  name: true,
  email: true,
  companyName: true,
} as const;

/**
 * Lista álbumes públicos candidatos (read-only CLF).
 * Excluye test / sin fotos / soft-deleted.
 */
export async function listPublicClfAlbumsForCoverage(options?: {
  take?: number;
}): Promise<{ ok: true; albums: CoverageAlbumSnapshot[] } | { ok: false; error: string }> {
  const probe = await probeClfReadonlyConnection();
  if (!probe.ok) {
    return { ok: false, error: probe.error || "CLF read-only no disponible" };
  }

  const take = options?.take ?? 100;
  const clf = getClfReadonlyClient();

  const rows = await clf.album.findMany({
    where: {
      deletedAt: null,
      isPublic: true,
      isTest: false,
      photos: { some: { isRemoved: false, storageDeletedAt: null } },
    },
    orderBy: [{ firstPhotoDate: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      title: true,
      publicSlug: true,
      eventId: true,
      city: true,
      isPublic: true,
      isHidden: true,
      deletedAt: true,
      firstPhotoDate: true,
      createdAt: true,
      expirationExtensionDays: true,
      cleanupStatus: true,
      coverThumbnailKey: true,
      userId: true,
      user: { select: photographerUserSelect },
      event: { select: { id: true, title: true } },
      collaborators: {
        select: {
          userId: true,
          user: { select: photographerUserSelect },
        },
        take: 20,
      },
      _count: {
        select: {
          photos: { where: { isRemoved: false, storageDeletedAt: null } },
        },
      },
      photos: {
        where: { isRemoved: false, storageDeletedAt: null },
        select: {
          userId: true,
          uploadedBy: { select: photographerUserSelect },
        },
        take: 200,
      },
    },
  });

  const albums: CoverageAlbumSnapshot[] = rows.map((row) => {
    const photographers: CoveragePhotographerInput[] = [];
    photographers.push({
      clfUserId: row.user.id,
      displayName: displayName(row.user),
      role: "PRIMARY",
      photoCount: row._count.photos,
      companyName: row.user.companyName?.trim() || null,
    });
    for (const c of row.collaborators) {
      photographers.push({
        clfUserId: c.user.id,
        displayName: displayName(c.user),
        role: "COLLABORATOR",
        photoCount: 0,
        companyName: c.user.companyName?.trim() || null,
      });
    }
    const uploadCounts = new Map<number, { user: { id: number; name: string | null; email: string; companyName: string | null }; count: number }>();
    for (const ph of row.photos) {
      const u = ph.uploadedBy;
      if (!u || u.id === row.userId) continue;
      const prev = uploadCounts.get(u.id);
      if (prev) prev.count += 1;
      else uploadCounts.set(u.id, { user: u, count: 1 });
    }
    for (const [, v] of uploadCounts) {
      photographers.push({
        clfUserId: v.user.id,
        displayName: displayName(v.user),
        role: "CONTRIBUTOR",
        photoCount: v.count,
        companyName: v.user.companyName?.trim() || null,
      });
    }

    return {
      clfAlbumId: row.id,
      publicSlug: row.publicSlug,
      title: row.title,
      clfEventId: row.eventId,
      eventTitle: row.event?.title ?? null,
      city: row.city,
      isPublic: row.isPublic,
      isHidden: row.isHidden,
      deletedAt: row.deletedAt,
      firstPhotoDate: row.firstPhotoDate,
      createdAt: row.createdAt,
      expirationExtensionDays: row.expirationExtensionDays,
      cleanupStatus: row.cleanupStatus,
      coverThumbnailKey: row.coverThumbnailKey,
      photoCount: row._count.photos,
      photographers,
    };
  });

  return { ok: true, albums };
}

export async function getClfAlbumSnapshotById(
  albumId: number,
): Promise<CoverageAlbumSnapshot | null> {
  const listed = await listPublicClfAlbumsForCoverage({ take: 500 });
  if (!listed.ok) return null;
  const hit = listed.albums.find((a) => a.clfAlbumId === albumId);
  if (hit) return hit;

  // Puede estar oculto/eliminado: leer directo para marcar STALE.
  const probe = await probeClfReadonlyConnection();
  if (!probe.ok) return null;
  const clf = getClfReadonlyClient();
  const row = await clf.album.findUnique({
    where: { id: albumId },
    select: {
      id: true,
      title: true,
      publicSlug: true,
      eventId: true,
      city: true,
      isPublic: true,
      isHidden: true,
      deletedAt: true,
      firstPhotoDate: true,
      createdAt: true,
      expirationExtensionDays: true,
      cleanupStatus: true,
      coverThumbnailKey: true,
      userId: true,
      user: { select: photographerUserSelect },
      event: { select: { id: true, title: true } },
      collaborators: {
        select: {
          user: { select: photographerUserSelect },
        },
        take: 20,
      },
      _count: {
        select: {
          photos: { where: { isRemoved: false, storageDeletedAt: null } },
        },
      },
    },
  });
  if (!row) return null;

  const photographers: CoveragePhotographerInput[] = [
    {
      clfUserId: row.user.id,
      displayName: displayName(row.user),
      role: "PRIMARY",
      photoCount: row._count.photos,
      companyName: row.user.companyName?.trim() || null,
    },
    ...row.collaborators.map((c) => ({
      clfUserId: c.user.id,
      displayName: displayName(c.user),
      role: "COLLABORATOR" as const,
      photoCount: 0,
      companyName: c.user.companyName?.trim() || null,
    })),
  ];

  return {
    clfAlbumId: row.id,
    publicSlug: row.publicSlug,
    title: row.title,
    clfEventId: row.eventId,
    eventTitle: row.event?.title ?? null,
    city: row.city,
    isPublic: row.isPublic,
    isHidden: row.isHidden,
    deletedAt: row.deletedAt,
    firstPhotoDate: row.firstPhotoDate,
    createdAt: row.createdAt,
    expirationExtensionDays: row.expirationExtensionDays,
    cleanupStatus: row.cleanupStatus,
    coverThumbnailKey: row.coverThumbnailKey,
    photoCount: row._count.photos,
    photographers,
  };
}
