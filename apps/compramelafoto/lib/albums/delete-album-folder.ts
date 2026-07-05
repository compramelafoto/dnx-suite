import { prisma } from "@/lib/prisma";
import { deletePhotoR2Assets } from "@/lib/photo-r2-cleanup";

type FolderRow = { id: number; parentId: number | null };

export function collectAlbumFolderSubtreeIds(
  rows: FolderRow[],
  rootId: number
): number[] {
  const ids = new Set<number>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (row.parentId != null && ids.has(row.parentId) && !ids.has(row.id)) {
        ids.add(row.id);
        changed = true;
      }
    }
  }
  return [...ids];
}

export function sortAlbumFolderIdsDeepestFirst(
  folderIds: number[],
  rows: FolderRow[]
): number[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const depth = (id: number): number => {
    let d = 1;
    let cur = byId.get(id);
    const seen = new Set<number>();
    while (cur?.parentId != null) {
      if (seen.has(cur.id)) return 999;
      seen.add(cur.id);
      cur = byId.get(cur.parentId);
      d++;
    }
    return d;
  };
  return [...folderIds].sort((a, b) => depth(b) - depth(a));
}

async function deleteRemovalRequestsForPhotos(photoIds: number[]): Promise<void> {
  if (photoIds.length === 0) return;
  const prismaAny = prisma as {
    removalRequest?: { deleteMany: (args: unknown) => Promise<unknown> };
  };
  try {
    if (prismaAny.removalRequest?.deleteMany) {
      await prismaAny.removalRequest.deleteMany({
        where: { photoId: { in: photoIds } },
      });
    }
  } catch {
    /* best effort */
  }
}

export type CascadeDeleteAlbumFolderResult =
  | { ok: true; deletedPhotos: number; deletedFolders: number }
  | { ok: false; error: string; status: number };

export async function cascadeDeleteAlbumFolder(opts: {
  albumId: number;
  folderId: number;
}): Promise<CascadeDeleteAlbumFolderResult> {
  const { albumId, folderId } = opts;

  const allFolderRows = await prisma.albumFolder.findMany({
    where: { albumId },
    select: { id: true, parentId: true },
  });

  if (!allFolderRows.some((folder) => folder.id === folderId)) {
    return { ok: false, error: "Carpeta no encontrada", status: 404 };
  }

  const subtreeIds = collectAlbumFolderSubtreeIds(allFolderRows, folderId);

  const photos = await prisma.photo.findMany({
    where: {
      albumId,
      folderId: { in: subtreeIds },
      isRemoved: false,
    },
    select: {
      id: true,
      originalKey: true,
      previewUrl: true,
      thumbWatermarkedKey: true,
      previewWatermarkedKey: true,
    },
  });

  const photoIds = photos.map((photo) => photo.id);

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { coverPhotoId: true },
  });

  if (album?.coverPhotoId != null && photoIds.includes(album.coverPhotoId)) {
    await prisma.album.update({
      where: { id: albumId },
      data: { coverPhotoId: null },
    });
  }

  await deleteRemovalRequestsForPhotos(photoIds);

  for (const photo of photos) {
    await deletePhotoR2Assets({ ...photo, id: photo.id });
  }

  const folderDeleteOrder = sortAlbumFolderIdsDeepestFirst(subtreeIds, allFolderRows);

  try {
    await prisma.$transaction(async (tx) => {
      if (photoIds.length > 0) {
        await tx.photo.deleteMany({ where: { id: { in: photoIds } } });
      }
      for (const fid of folderDeleteOrder) {
        await tx.albumFolder.delete({ where: { id: fid } });
      }
    });
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes("Foreign key") || msg.includes("_fkey")) {
      return {
        ok: false,
        error:
          "No se pudo eliminar porque hay fotos con pedidos u otros vínculos activos. Mové esas fotos o contactá soporte.",
        status: 409,
      };
    }
    throw err;
  }

  return {
    ok: true,
    deletedPhotos: photoIds.length,
    deletedFolders: subtreeIds.length,
  };
}
