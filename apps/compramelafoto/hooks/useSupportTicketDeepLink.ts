"use client";

import { useEffect, useState } from "react";

/** ID de elemento para scroll desde ?ticket= (paneles de soporte). */
export function supportTicketSectionId(ticketId: number): string {
  return `support-ticket-${ticketId}`;
}

/**
 * Si la URL trae ?ticket=ID y el ticket está en la lista cargada,
 * marca el ticket y hace scroll suave al bloque correspondiente.
 */
export function useSupportTicketDeepLink(
  tickets: { id: number }[],
  ticketsLoading: boolean,
  ticketParam: string | null | undefined,
  enabled: boolean = true
): number | null {
  const [focusedId, setFocusedId] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setFocusedId(null);
      return;
    }
    if (ticketsLoading || !ticketParam) {
      setFocusedId(null);
      return;
    }
    const id = Number(ticketParam);
    if (!Number.isFinite(id)) {
      setFocusedId(null);
      return;
    }
    const exists = tickets.some((t) => t.id === id);
    if (!exists) {
      setFocusedId(null);
      return;
    }
    setFocusedId(id);
    const timer = window.setTimeout(() => {
      document.getElementById(supportTicketSectionId(id))?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [enabled, ticketsLoading, ticketParam, tickets]);

  return focusedId;
}
