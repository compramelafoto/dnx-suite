/**
 * Indica si el fotógrafo tiene coordenadas de trabajo válidas en su perfil (User).
 * Se usa para invitaciones a eventos cercanos y avisos al iniciar sesión.
 */
export function userHasWorkLocation(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): boolean {
  if (latitude == null || longitude == null) return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return latitude !== 0 || longitude !== 0;
}
