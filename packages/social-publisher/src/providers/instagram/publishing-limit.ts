import { createMetaGraphClient } from "./graph-client";

export type PublishingLimit = { used: number; total: number };

/**
 * Cupo de publicaciones de la cuenta (100 cada 24 h móviles; un carrusel cuenta 1).
 *
 * Devuelve null si Meta no contesta: no saber el cupo no es razón para no publicar.
 * El límite real lo aplica Meta igual, y ahí sí el error se registra y se reintenta.
 */
export async function fetchPublishingLimit(
  igUserId: string,
  accessToken: string,
  deps: { fetchImpl?: typeof fetch; apiVersion?: string } = {},
): Promise<PublishingLimit | null> {
  const client = createMetaGraphClient({
    apiVersion: deps.apiVersion,
    fetchImpl: deps.fetchImpl,
  });
  try {
    const r = await client.request<{
      data?: { quota_usage?: number; config?: { quota_total?: number } }[];
    }>(`/${igUserId}/content_publishing_limit?fields=config,quota_usage`, {
      accessToken,
    });
    const fila = r.data?.[0];
    if (!fila) return null;
    return {
      used: Number(fila.quota_usage ?? 0),
      total: Number(fila.config?.quota_total ?? 100),
    };
  } catch {
    return null;
  }
}

export function hasQuotaFor(limit: PublishingLimit | null, needed: number): boolean {
  if (!limit) return true;
  return limit.used + needed <= limit.total;
}
