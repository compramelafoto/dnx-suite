import { prisma } from "@/lib/prisma";
import { Role } from "@/lib/prisma";
import { canCreateAlbumFoldersOnUpload } from "@/lib/albums/album-folder-permissions";
import { ensureAlbumFolderPath } from "@/lib/albums/ensure-album-folder-path";
import { parseUploadRelativePath } from "@/lib/albums/parse-upload-relative-path";
import {
  PhotoAlbumFolderValidationError,
  resolvePhotoAlbumFolder,
} from "@/lib/albums/resolve-photo-album-folder";
import { ensureEventOrganizerFolderPath } from "@/lib/events/ensure-event-folder-path";
import { isEventOrganizerUser } from "@/lib/events/event-organizer-access";
import {
  PhotoEventFolderValidationError,
  resolvePhotoEventFolder,
} from "@/lib/events/resolve-photo-event-folder";

type UploadAuthUser = {
  id: number;
  role: Role;
};

export async function ensureMpConnected(user: UploadAuthUser) {
  if (user.role === Role.LAB_PHOTOGRAPHER || user.role === Role.LAB) {
    const lab = await prisma.lab.findUnique({
      where: { userId: user.id },
      select: { mpConnectedAt: true, mpAccessToken: true, mpUserId: true },
    });
    const mpConnected = !!(lab?.mpConnectedAt && lab?.mpAccessToken && lab?.mpUserId);
    if (!mpConnected) {
      return { ok: false, error: "Debés conectar Mercado Pago para subir fotos." };
    }
  } else {
    const photographer = await prisma.user.findUnique({
      where: { id: user.id },
      select: { mpAccessToken: true },
    });
    if (!photographer?.mpAccessToken) {
      return { ok: false, error: "Debés conectar Mercado Pago para subir fotos." };
    }
  }

  return { ok: true, error: null };
}

export type AlbumUploadAccessResult =
  | { ok: true; error: null; status: 200; albumEventId: number | null }
  | { ok: false; error: string; status: number };

export async function ensureAlbumUploadAccess(
  albumId: number,
  userId: number
): Promise<AlbumUploadAccessResult> {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { userId: true, isPublic: true, isHidden: true, eventId: true },
  });

  if (!album) {
    return { ok: false, error: "Álbum no encontrado", status: 404 };
  }

  if (album.userId !== userId) {
    if (!album.isPublic || album.isHidden) {
      return {
        ok: false,
        error: "Este álbum no permite colaboración. Solo el creador puede agregar fotos.",
        status: 403,
      };
    }
  }

  return { ok: true, error: null, status: 200, albumEventId: album.eventId };
}

export type ResolvedPhotoUploadFolders = {
  eventFolderId?: number;
  folderId?: number;
};

/**
 * Resuelve carpeta de destino para subida: eventFolderId (colaborativo) o folderId (álbum simple).
 * Si viene `relativePath` (subida de carpeta completa), tiene prioridad sobre ids explícitos.
 */
export async function resolvePhotoUploadFolders(params: {
  albumId: number;
  albumEventId: number | null;
  userId: number;
  eventFolderIdRaw: unknown;
  folderIdRaw: unknown;
  relativePathRaw?: unknown;
}): Promise<ResolvedPhotoUploadFolders> {
  const parsed = parseUploadRelativePath(
    params.relativePathRaw != null ? String(params.relativePathRaw) : null
  );

  if (parsed.folderSegments.length > 0) {
    const albumEvent =
      typeof params.albumEventId === "number" &&
      Number.isFinite(params.albumEventId) &&
      params.albumEventId > 0
        ? params.albumEventId
        : null;

    if (albumEvent != null) {
      const allowCreate = await isEventOrganizerUser(params.userId, albumEvent);
      const eventFolderId = await ensureEventOrganizerFolderPath({
        eventId: albumEvent,
        createdByUserId: params.userId,
        segments: parsed.folderSegments,
        allowCreate,
      });
      if (eventFolderId != null) {
        return { eventFolderId };
      }
    } else {
      const album = await prisma.album.findUnique({
        where: { id: params.albumId },
        select: { id: true, userId: true, eventId: true, deletedAt: true },
      });
      if (!album || album.deletedAt) {
        throw new PhotoAlbumFolderValidationError("Álbum no encontrado.");
      }
      const allowCreate = canCreateAlbumFoldersOnUpload(album, params.userId);
      const folderId = await ensureAlbumFolderPath({
        albumId: params.albumId,
        createdByUserId: params.userId,
        segments: parsed.folderSegments,
        allowCreate,
      });
      if (folderId != null) {
        return { folderId };
      }
    }
  }

  const hasEventRaw =
    params.eventFolderIdRaw !== undefined &&
    params.eventFolderIdRaw !== null &&
    String(params.eventFolderIdRaw).trim() !== "";
  const hasAlbumRaw =
    params.folderIdRaw !== undefined &&
    params.folderIdRaw !== null &&
    String(params.folderIdRaw).trim() !== "";

  if (hasEventRaw && hasAlbumRaw) {
    throw new PhotoAlbumFolderValidationError(
      "Enviá solo eventFolderId o folderId, no ambos."
    );
  }

  try {
    const eventFolder = await resolvePhotoEventFolder({
      albumEventId: params.albumEventId,
      eventFolderIdRaw: params.eventFolderIdRaw,
      uploadedByUserId: params.userId,
    });
    if (eventFolder) {
      return { eventFolderId: eventFolder.id };
    }
  } catch (e: unknown) {
    if (e instanceof PhotoEventFolderValidationError) throw e;
    throw e;
  }

  try {
    const albumFolder = await resolvePhotoAlbumFolder({
      albumId: params.albumId,
      albumEventId: params.albumEventId,
      folderIdRaw: params.folderIdRaw,
    });
    if (albumFolder) {
      return { folderId: albumFolder.id };
    }
  } catch (e: unknown) {
    if (e instanceof PhotoAlbumFolderValidationError) throw e;
    throw e;
  }

  return {};
}

export function isPhotoFolderValidationError(
  e: unknown
): e is PhotoEventFolderValidationError | PhotoAlbumFolderValidationError {
  return (
    e instanceof PhotoEventFolderValidationError ||
    e instanceof PhotoAlbumFolderValidationError
  );
}
