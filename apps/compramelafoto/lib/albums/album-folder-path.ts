import type { PrismaClient } from "@/lib/prisma";
import { buildAlbumFolderPath } from "@/lib/albums/album-folder-validation";

type Tx = Pick<PrismaClient, "albumFolder">;

/** Recalcula `path` de un nodo y todos sus descendientes tras renombrar o mover. */
export async function refreshAlbumFolderSubtreePaths(
  db: Tx,
  folderId: number,
  newPath: string
): Promise<void> {
  await db.albumFolder.update({
    where: { id: folderId },
    data: { path: newPath },
  });

  const children = await db.albumFolder.findMany({
    where: { parentId: folderId },
    select: { id: true, name: true },
  });

  for (const child of children) {
    const childPath = buildAlbumFolderPath(newPath, child.name);
    await refreshAlbumFolderSubtreePaths(db, child.id, childPath);
  }
}

export async function computePathForNewAlbumFolder(
  db: Tx,
  parentId: number | null,
  name: string
): Promise<string> {
  if (parentId == null) {
    return buildAlbumFolderPath(null, name);
  }
  const parent = await db.albumFolder.findUnique({
    where: { id: parentId },
    select: { path: true },
  });
  if (!parent) {
    throw new Error("La carpeta padre no existe.");
  }
  return buildAlbumFolderPath(parent.path, name);
}
