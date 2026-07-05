/** Rutas API públicas de videos (sin query de venta). */
export function albumPublicVideosApiPath(publicSlug: string): string {
  return `/api/public/albums/${encodeURIComponent(publicSlug.trim())}/videos`;
}

export function eventPublicVideosApiPath(shareSlug: string): string {
  return `/api/public/events/${encodeURIComponent(shareSlug.trim())}/videos`;
}
