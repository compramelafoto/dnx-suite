/** Modo de cantidad para packs digitales de galería (metadato en `description`). */
export type AlbumPackQuantityMode = "FIXED" | "ALL_EVENT_PHOTOS" | "ALL_MY_PHOTOS";

const PACK_QTY_PREFIX = /^@packQty:(ALL_EVENT_PHOTOS|ALL_MY_PHOTOS)\n?/;

export const ALBUM_PACK_QUANTITY_MODE_LABELS: Record<
  Exclude<AlbumPackQuantityMode, "FIXED">,
  string
> = {
  ALL_EVENT_PHOTOS: "Todas las fotos",
  ALL_MY_PHOTOS: "Todas mis fotos",
};

export const ALBUM_PACK_QUANTITY_MODE_HELP: Record<
  Exclude<AlbumPackQuantityMode, "FIXED">,
  string
> = {
  ALL_EVENT_PHOTOS: "Incluye todas las fotos publicadas del álbum que el cliente elija en la galería.",
  ALL_MY_PHOTOS:
    "Solo las fotos donde aparece el cliente (reconocimiento facial / selfie en la galería).",
};

export function stripPackQtyFromDescription(description: string | null | undefined): string {
  if (!description) return "";
  return description.replace(PACK_QTY_PREFIX, "").trimStart();
}

export function parsePackQtyFromDescription(
  description: string | null | undefined
): AlbumPackQuantityMode {
  if (!description) return "FIXED";
  const match = description.match(/^@packQty:(ALL_EVENT_PHOTOS|ALL_MY_PHOTOS)/);
  if (match) return match[1] as AlbumPackQuantityMode;
  return "FIXED";
}

export function encodePackDescriptionWithQty(
  description: string,
  mode: Exclude<AlbumPackQuantityMode, "FIXED">
): string {
  const clean = stripPackQtyFromDescription(description);
  const prefix = `@packQty:${mode}\n`;
  return clean ? `${prefix}${clean}` : prefix.trimEnd();
}

/** Solo activa ALL_* cuando `description` incluye `@packQty:…` explícito; si no, FIXED. */
export function resolveAlbumPackQuantityMode(pack: {
  description?: string | null;
  requiresSelection?: boolean;
  requiresDesign?: boolean;
}): AlbumPackQuantityMode {
  return parsePackQtyFromDescription(pack.description);
}

export function isAlbumPackAllMyPhotosMode(
  pack: Parameters<typeof resolveAlbumPackQuantityMode>[0]
): boolean {
  return resolveAlbumPackQuantityMode(pack) === "ALL_MY_PHOTOS";
}

export function isAlbumPackAllEventPhotosMode(
  pack: Parameters<typeof resolveAlbumPackQuantityMode>[0]
): boolean {
  return resolveAlbumPackQuantityMode(pack) === "ALL_EVENT_PHOTOS";
}
