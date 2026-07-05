export type AlbumFolderAlbumContext = {
  id: number;
  userId: number;
  eventId: number | null;
  deletedAt: Date | null;
};

export type AlbumFolderAccessResult =
  | { ok: true; album: AlbumFolderAlbumContext }
  | { ok: false; error: string; status: number };

/** Álbumes colaborativos usan EventFolder; AlbumFolder solo aplica sin eventId. */
export function albumSupportsAlbumFolders(eventId: number | null | undefined): boolean {
  return !(typeof eventId === "number" && Number.isFinite(eventId) && eventId > 0);
}

export function canManageAlbumFolders(
  album: AlbumFolderAlbumContext,
  requestingUserId: number
): boolean {
  if (album.deletedAt) return false;
  if (!albumSupportsAlbumFolders(album.eventId)) return false;
  return album.userId === requestingUserId;
}

/** Solo el dueño de un álbum simple puede crear carpetas vía subida webkitRelativePath. */
export function canCreateAlbumFoldersOnUpload(
  album: AlbumFolderAlbumContext,
  requestingUserId: number
): boolean {
  return canManageAlbumFolders(album, requestingUserId);
}

export function canViewAlbumFolders(
  album: AlbumFolderAlbumContext,
  requestingUserId: number
): boolean {
  if (album.deletedAt) return false;
  if (!albumSupportsAlbumFolders(album.eventId)) return false;
  return album.userId === requestingUserId;
}

export function assertAlbumFolderFeature(
  album: AlbumFolderAlbumContext
): { ok: true } | { ok: false; error: string; status: number } {
  if (album.deletedAt) {
    return { ok: false, error: "Álbum no encontrado", status: 404 };
  }
  if (!albumSupportsAlbumFolders(album.eventId)) {
    return {
      ok: false,
      error:
        "Este álbum está vinculado a un evento colaborativo. Usá las carpetas del evento (panel del organizador).",
      status: 400,
    };
  }
  return { ok: true };
}
