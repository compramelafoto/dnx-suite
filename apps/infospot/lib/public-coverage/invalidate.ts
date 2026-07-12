/**
 * Invalidación de cache del view model público de coberturas.
 */

import { revalidatePath, revalidateTag } from "next/cache";

export function invalidatePublicCoverageCache(opts?: {
  articleSlug?: string | null;
  eventSlug?: string | null;
}) {
  revalidateTag("infospot-public-coverage", "max");
  if (opts?.articleSlug) {
    revalidateTag(`article-${opts.articleSlug}`, "max");
    revalidatePath(`/noticias/${opts.articleSlug}`);
  }
  if (opts?.eventSlug) {
    revalidatePath(`/eventos/${opts.eventSlug}`);
  }
  revalidatePath("/");
}

/**
 * Job / acción manual: reconciliar comercial + invalidar cache público.
 */
export async function reconcilePublicCoverageCommercial(options?: {
  take?: number;
}): Promise<{ ok: boolean; photosUpdated: number; error?: string }> {
  const { reconcileEditorialPhotoCommercialStatus } = await import(
    "../editorial-photos/reconcile"
  );
  const result = await reconcileEditorialPhotoCommercialStatus({
    take: options?.take ?? 80,
  });
  invalidatePublicCoverageCache();
  return {
    ok: result.ok,
    photosUpdated: result.updated,
    error: result.error,
  };
}
