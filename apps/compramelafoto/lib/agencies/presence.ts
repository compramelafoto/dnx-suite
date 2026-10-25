/** "Estoy acá" del fotógrafo de una agencia. Argentina no tiene horario de verano: UTC−3 fijo. */
const ART_OFFSET_MS = 3 * 60 * 60 * 1000;

export function endOfDayArgentina(now: Date): Date {
  const art = new Date(now.getTime() - ART_OFFSET_MS);
  const endArtAsUtc = Date.UTC(art.getUTCFullYear(), art.getUTCMonth(), art.getUTCDate(), 23, 59, 59, 999);
  return new Date(endArtAsUtc + ART_OFFSET_MS);
}

export function activePresencePoint(
  presence: { lat: number; lng: number; validUntil: Date } | null,
  at: Date
): { lat: number; lng: number } | null {
  if (!presence) return null;
  return presence.validUntil.getTime() >= at.getTime() ? { lat: presence.lat, lng: presence.lng } : null;
}
