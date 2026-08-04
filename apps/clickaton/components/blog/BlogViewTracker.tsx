"use client";

import { useEffect, useRef } from "react";

/**
 * Registra una vista de la nota. La escritura de la cookie de visitante
 * necesita una route handler: el render del server component es solo lectura.
 */
export function BlogViewTracker({ slug }: { slug: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void fetch("/api/public/blog/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({ slug }),
    }).catch(() => undefined);
  }, [slug]);

  return null;
}
