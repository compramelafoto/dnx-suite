import type { AlbumPackSelectionMode } from "@/lib/album-packs/album-pack-composition-types";
import { resolveAlbumPackQuantityMode } from "@/lib/album-packs/album-pack-quantity-mode";

export type { AlbumPackSelectionMode };

/**
 * Normaliza el modo de selección del pack.
 * Compatibilidad: lee `@packQty:ALL_MY_PHOTOS` / `@packQty:ALL_EVENT_PHOTOS` en `description`.
 * Sin prefijo → `FIXED`.
 */
export function resolveAlbumPackSelectionMode(pack: {
  description?: string | null;
  requiresSelection?: boolean;
  requiresDesign?: boolean;
}): AlbumPackSelectionMode {
  return resolveAlbumPackQuantityMode(pack);
}

export function normalizeAlbumPackSelectionMode(
  pack: Parameters<typeof resolveAlbumPackSelectionMode>[0]
): AlbumPackSelectionMode {
  return resolveAlbumPackSelectionMode(pack);
}
