"use client";

import { FUNNEL_EVENTS, type FunnelEventName } from "@/lib/funnel-events";
import { metaEventForFunnel, metaTrack } from "@/lib/meta-pixel";

export async function trackFunnelEvent(
  event: FunnelEventName,
  opts?: { albumId?: string | number; orderId?: number; path?: string }
): Promise<void> {
  // Copia del paso al píxel de Meta (si está configurado) para optimizar los anuncios.
  const metaEvent = metaEventForFunnel(event);
  if (metaEvent) {
    metaTrack(metaEvent, opts?.albumId != null ? { content_ids: [String(opts.albumId)], content_type: "product" } : undefined);
  }
  try {
    await fetch("/api/analytics/funnel", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        albumId: opts?.albumId,
        orderId: opts?.orderId,
        path: opts?.path ?? (typeof window !== "undefined" ? window.location.pathname : undefined),
      }),
    });
  } catch {
    // no bloquear UX
  }
}

export { FUNNEL_EVENTS };
