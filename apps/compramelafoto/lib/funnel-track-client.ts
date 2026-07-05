"use client";

import { FUNNEL_EVENTS, type FunnelEventName } from "@/lib/funnel-events";

export async function trackFunnelEvent(
  event: FunnelEventName,
  opts?: { albumId?: string | number; orderId?: number; path?: string }
): Promise<void> {
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
