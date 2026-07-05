import { prisma } from "@/lib/prisma";
import { validateAlbumFolderCreate } from "@/lib/albums/album-folder-domain";
import { PhotoAlbumFolderValidationError } from "@/lib/albums/resolve-photo-album-folder";
import { validateRelativePathSegments } from "@/lib/albums/album-folder-validation";
import { computePathForNewAlbumFolder } from "@/lib/albums/album-folder-path";

/**
 * Resuelve o crea la cadena de carpetas `AlbumFolder` para una ruta relativa de subida.
 * @returns id de la carpeta hoja, o null si no hay segmentos.
 */
export async function ensureAlbumFolderPath(opts: {
  albumId: number;
  createdByUserId: number;
  segments: string[];
  allowCreate: boolean;
}): Promise<number | null> {
  if (opts.segments.length === 0) return null;

  const validated = validateRelativePathSegments(opts.segments);
  if (!validated.ok) {
    throw new PhotoAlbumFolderValidationError(validated.error);
  }

  let parentId: number | null = null;

  for (const segment of validated.segments) {
    const currentParentId: number | null = parentId;
    const existing: { id: number } | null = await prisma.albumFolder.findFirst({
      where: {
        albumId: opts.albumId,
        parentId: currentParentId,
        name: segment,
      },
      select: { id: true },
    });

    if (existing) {
      parentId = existing.id;
      continue;
    }

    if (!opts.allowCreate) {
      throw new PhotoAlbumFolderValidationError(
        `La carpeta "${segment}" no existe. Creá la estructura antes de subir o subí archivos sueltos a una carpeta existente.`
      );
    }

    const rows = await prisma.albumFolder.findMany({
      where: { albumId: opts.albumId },
      select: { id: true, albumId: true, parentId: true, name: true, path: true, sortOrder: true },
    });

    const createCheck = validateAlbumFolderCreate({ parentId, rows });
    if (!createCheck.ok) {
      throw new PhotoAlbumFolderValidationError(createCheck.error);
    }

    const path = await computePathForNewAlbumFolder(prisma, parentId, segment);
    const siblings = rows.filter((r) => (r.parentId ?? null) === parentId);
    const sortOrder =
      siblings.length === 0
        ? 0
        : Math.max(...siblings.map((s) => s.sortOrder), -1) + 1;

    const created: { id: number } = await prisma.albumFolder.create({
      data: {
        albumId: opts.albumId,
        parentId,
        name: segment,
        path,
        sortOrder,
        createdById: opts.createdByUserId,
      },
      select: { id: true },
    });
    parentId = created.id;
  }

  return parentId;
}
