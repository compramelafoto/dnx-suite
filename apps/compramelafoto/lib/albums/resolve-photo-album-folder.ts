import { prisma } from "@/lib/prisma";
import { albumSupportsAlbumFolders } from "@/lib/albums/album-folder-permissions";

export class PhotoAlbumFolderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoAlbumFolderValidationError";
  }
}

function parsePositiveIntOrNull(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }
  if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const n = parseInt(trimmed, 10);
    if (Number.isInteger(n) && n > 0 && String(n) === trimmed) {
      return n;
    }
  }
  throw new PhotoAlbumFolderValidationError("folderId no es válido.");
}

/**
 * Valida `folderId` opcional frente al álbum.
 *
 * @returns Carpeta válida; `null` si no se envió carpeta.
 * @throws PhotoAlbumFolderValidationError si hay conflicto de datos del cliente (400).
 */
export async function resolvePhotoAlbumFolder(params: {
  albumId: number;
  albumEventId: number | null;
  folderIdRaw: unknown;
}): Promise<{ id: number; albumId: number; path: string } | null> {
  const folderId = parsePositiveIntOrNull(params.folderIdRaw);
  if (folderId === null) {
    return null;
  }

  if (!albumSupportsAlbumFolders(params.albumEventId)) {
    throw new PhotoAlbumFolderValidationError(
      "Este álbum usa carpetas de evento; no podés asignar folderId de álbum."
    );
  }

  const folder = await prisma.albumFolder.findUnique({
    where: { id: folderId },
    select: { id: true, albumId: true, path: true },
  });

  if (!folder) {
    throw new PhotoAlbumFolderValidationError("La carpeta del álbum no existe.");
  }

  if (folder.albumId !== params.albumId) {
    throw new PhotoAlbumFolderValidationError("La carpeta no pertenece a este álbum.");
  }

  return folder;
}
