/**
 * Cache en memoria de consultas de geocodificación (evita repetición inmediata).
 */

type CacheEntry<T> = { value: T; expiresAt: number };

const store = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export function geocodeCacheKey(kind: string, parts: string[]): string {
  return `${kind}:${parts.map((p) => p.trim().toLowerCase()).join("|")}`;
}

export function getCachedGeocode<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function setCachedGeocode<T>(
  key: string,
  value: T,
  ttlMs = DEFAULT_TTL_MS,
): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Solo tests. */
export function clearGeocodeCache(): void {
  store.clear();
}
