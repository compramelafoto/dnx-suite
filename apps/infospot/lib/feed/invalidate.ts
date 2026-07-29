/**
 * Invalidación de caché del feed unificado.
 */

import { revalidatePath, revalidateTag } from "next/cache";

export const PUBLIC_FEED_CACHE_TAGS = [
  "infospot-home-feed",
  "infospot-public-content",
  "infospot-home",
] as const;

/** Tags emitidos al invalidar (útil para tests). */
export function collectPublicFeedRevalidateTags(options?: {
  itemId?: string;
}): string[] {
  const tags: string[] = [...PUBLIC_FEED_CACHE_TAGS];
  if (options?.itemId) {
    tags.push(`infospot-feed-item:${options.itemId}`);
  }
  return tags;
}

export function revalidatePublicFeedCache(options?: {
  itemId?: string;
  revalidateHomePath?: boolean;
}) {
  for (const tag of collectPublicFeedRevalidateTags(options)) {
    revalidateTag(tag, "max");
  }
  if (options?.revalidateHomePath !== false) {
    revalidatePath("/");
  }
}
