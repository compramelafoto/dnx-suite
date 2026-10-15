"use client";

import { useEffect, useRef } from "react";

/**
 * Registra la vista del artículo. Va desde el navegador y no desde la página porque contar una
 * vista por persona necesita escribir la cookie del visitante, y un Server Component sólo puede
 * leer cookies. Mismo camino que Clickatón (`components/blog/BlogViewTracker.tsx`).
 *
 * `keepalive`: si el visitante se va enseguida, el pedido igual sale.
 */
export function BlogViewTracker({ endpoint, slug }: { endpoint: string; slug: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({ slug }),
    }).catch(() => undefined);
  }, [endpoint, slug]);

  return null;
}
