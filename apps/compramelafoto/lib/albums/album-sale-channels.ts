/**
 * Flags legacy en `Album` (enableDigitalPhotos / enablePrintedPhotos).
 * El checkout público usa estos campos; las capabilities del álbum son analíticas en paralelo.
 */

/** Activo salvo desactivación explícita (`false`). */
export function isLegacyAlbumDigitalSalesEnabled(
  value: boolean | null | undefined
): boolean {
  return value !== false;
}

/** Activo salvo desactivación explícita (`false`). */
export function isLegacyAlbumPrintSalesEnabled(
  value: boolean | null | undefined
): boolean {
  return value !== false;
}
