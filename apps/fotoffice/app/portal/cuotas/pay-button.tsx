"use client";

import { useState, useTransition } from "react";
import { startDuesPaymentAction } from "@/app/actions/dues-payment";

/**
 * Lleva al socio a MercadoPago.
 *
 * No hace `redirect` desde el servidor: el checkout es una URL externa y el navegador tiene
 * que ir ahí con la interacción del socio. El botón queda deshabilitado mientras se abre,
 * para no crear dos intenciones de pago con un doble clic.
 */
export function PayButton({ howMany, label }: { howMany: string; label: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function pagar() {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("howMany", howMany);
      const r = await startDuesPaymentAction(data);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      window.location.href = r.checkoutUrl;
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={pagar}
        disabled={pendiente}
        className="fo-btn fo-btn-primary w-full text-sm disabled:opacity-60"
      >
        {pendiente ? "Abriendo el pago…" : label}
      </button>
      {error ? (
        <p className="text-xs text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
