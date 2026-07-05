/**
 * Los packs de galería tienen gate propio: no exigen activar venta suelta digital/impresa del álbum.
 * `getPublicVisiblePacks` ya valida pack activo, fase, composición y producto impreso vendible.
 */
export function isAlbumPackGalleryAvailable(publicVisiblePackCount: number): boolean {
  return publicVisiblePackCount > 0;
}
