"use client";

import { useEffect, useRef } from "react";

type Props = {
  kind: "ARTICLE_VIEW" | "EVENT_VIEW";
  articleId?: string | null;
  eventId?: string | null;
};

/**
 * Registra vista pública sin bloquear navegación.
 * Dedup en cliente + servidor (ventana corta).
 */
export function ContentViewTracker({ kind, articleId, eventId }: Props) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    if (!articleId && !eventId) return;
    sent.current = true;

    const body = JSON.stringify({ kind, articleId, eventId });
    const url = "/api/metrics/view";

    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(url, blob);
        return;
      }
    } catch {
      /* fallback */
    }

    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* no bloquear */
    });
  }, [kind, articleId, eventId]);

  return null;
}
