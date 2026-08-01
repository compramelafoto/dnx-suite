/**
 * Reglas de visibilidad del storefront público.
 * Fuente: campos existentes isStoreEnabled / storeStatus / storeSlug / storePrice.
 */

/** Estados comerciales visibles en vitrina (no ocultos). */
export const STOREFRONT_VISIBLE_STATUSES = ["ACTIVE", "OUT_OF_STOCK"] as const;

export type StorefrontVisibleStatus = (typeof STOREFRONT_VISIBLE_STATUSES)[number];

/** Copia mutable para filtros Prisma (`in`). */
export const STOREFRONT_VISIBLE_STATUS_LIST: StorefrontVisibleStatus[] = [
  ...STOREFRONT_VISIBLE_STATUSES,
];

export function isStorefrontVisibleStatus(
  status: string | null | undefined,
): status is StorefrontVisibleStatus {
  return (
    status != null &&
    (STOREFRONT_VISIBLE_STATUSES as readonly string[]).includes(status)
  );
}

/** Truncado seguro para descripción de card. */
export function toStoreShortDescription(
  storeDescription: string | null | undefined,
  description: string | null | undefined,
  maxLen = 140,
): string | null {
  const raw = (storeDescription ?? description ?? "").trim();
  if (!raw) return null;
  if (raw.length <= maxLen) return raw;
  const sliced = raw.slice(0, maxLen - 1).trimEnd();
  return `${sliced}…`;
}

/**
 * Deduplica por storeSlug (unique es por edición; en listado global
 * preferimos el de menor storeSortOrder / nombre).
 */
export function dedupeStoreProductsBySlug<
  T extends { storeSlug: string; storeSortOrder: number; name: string },
>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    const key = item.storeSlug.trim().toLowerCase();
    if (!key) continue;
    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, item);
      continue;
    }
    if (
      item.storeSortOrder < prev.storeSortOrder ||
      (item.storeSortOrder === prev.storeSortOrder &&
        item.name.localeCompare(prev.name, "es") < 0)
    ) {
      seen.set(key, item);
    }
  }
  return [...seen.values()];
}
