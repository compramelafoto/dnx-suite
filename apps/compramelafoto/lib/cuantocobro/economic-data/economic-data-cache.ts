type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

export const ECONOMIC_DATA_CACHE_TTL_MS = 60 * 60 * 1000;

export function getEconomicDataCacheKey(countryCode: string, type: string): string {
  return `economic-data:${countryCode}:${type}`;
}

export function readEconomicDataCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function writeEconomicDataCache<T>(key: string, value: T, ttlMs = ECONOMIC_DATA_CACHE_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearEconomicDataCache(): void {
  store.clear();
}
