/** Opt-in legacy / debug: `?includePhotos=1` devuelve `photos[]` completo en GET detalle álbum.
 * No usar en producción: ningún flujo del dashboard lo consume (desde 3.3D).
 * Reservado para scripts de migración o diagnóstico manual. */
export function albumDashboardGetIncludePhotos(
  searchParams: Pick<URLSearchParams, "get">
): boolean {
  const value = searchParams.get("includePhotos");
  return value === "1" || value === "true";
}
