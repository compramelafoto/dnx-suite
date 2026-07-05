export type AlbumBlockerKind =
  | "ORDER_ITEM"
  | "ORDER"
  | "ALBUM_INVITATION"
  | "ALBUM_ACCESS"
  | "ALBUM_INTEREST"
  | "REMOVAL_REQUEST"
  | "ORGANIZER_DOWNLOAD"
  | "PACK_DEFINITION"
  | "PRECOMPRA_ORDER"
  | "ACTIVE_PRINT_ORDER";

export type AlbumBlocker = {
  kind: AlbumBlockerKind;
  count: number;
};

export type AlbumBlockerReport = {
  blockers: AlbumBlocker[];
  /** Fotos referenciadas por OrderItem (no se pueden borrar filas). */
  hasPhotoRowBlockers: boolean;
  /** FK directas sobre Album (Order, AlbumInvitation, etc.). */
  hasAlbumTableBlockers: boolean;
  /** Alias legado: cualquier bloqueo que impida hard delete del álbum. */
  hasAlbumDeleteBlockers: boolean;
  primaryReason: string | null;
  /** Fotos que aún existen en BD para este álbum. */
  remainingPhotoRows: number;
};

export type PhotoBlockerReport = {
  hasOrderItem: boolean;
  orderItemCount: number;
};

export type DestructiveAlbumDeleteAttempt = {
  attempted: boolean;
  albumDeleted: boolean;
  photosDeleted: number;
  blockers: string | null;
  error: string | null;
  errorCode: string | null;
};
