"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Vuelve a pedir la pantalla al servidor cada cierto tiempo.
 *
 * Se usa mientras falta que otra persona haga algo (por ejemplo, escanear el QR
 * en el punto de acreditación): la persona no tiene que recargar a mano.
 */
export function ParticipantLiveRefresher({ intervalMs = 10000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, router]);

  return null;
}
