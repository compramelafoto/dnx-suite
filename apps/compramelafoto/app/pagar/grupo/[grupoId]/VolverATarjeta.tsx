"use client";

import { useState } from "react";
import { volverATarjetaCarrito } from "@/lib/split-1n-carrito-evento/mercado-pago-grupo";

/**
 * «Pagar con tarjeta en su lugar»: cancela el pago de Mercado Pago que quedó abierto (sólo si no
 * se pagó) y recarga la página con la tarjeta disponible.
 */
export default function VolverATarjeta({ grupoId }: { grupoId: string }) {
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function volver() {
    if (yendo) return;
    setYendo(true);
    setError(null);
    try {
      const r = await volverATarjetaCarrito({ grupoId });
      if (r.ok) {
        window.location.reload();
        return;
      }
      setError(r.mensaje);
    } catch {
      setError("No pudimos cambiar el medio de pago. Probá de nuevo en unos minutos.");
    }
    setYendo(false);
  }

  return (
    <div className="space-y-1 text-center">
      <button type="button" onClick={volver} disabled={yendo} className="text-sm text-neutral-700 underline disabled:opacity-60">
        {yendo ? "Cambiando…" : "Prefiero pagar con tarjeta"}
      </button>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
