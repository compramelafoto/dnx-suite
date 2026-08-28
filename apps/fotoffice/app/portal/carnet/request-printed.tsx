"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { requestPrintedCardAction } from "@/app/actions/request-printed-card";

/**
 * Pide la tarjeta impresa.
 *
 * El cargo entra al circuito de cuotas —no hay un cobro aparte— pero el pago se ofrece acá
 * mismo: a quien acaba de pagar su inscripción no le queda ninguna cuota con la cual juntarlo,
 * y mandarlo a buscarlo después es perderlo.
 */
export function RequestPrintedCard({ priceLabel }: { priceLabel: string }) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pagar, setPagar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  if (mensaje) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--fo-success)] leading-relaxed">{mensaje}</p>
        {pagar ? (
          <Link href={pagar} className="fo-btn fo-btn-primary inline-flex text-sm">
            Pagarla ahora
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await requestPrintedCardAction();
            if (!r.ok) {
              setError(r.error);
              return;
            }
            setMensaje(r.message);
            setPagar(r.payPath);
          })
        }
        className="fo-btn fo-btn-secondary w-full text-sm disabled:opacity-60"
      >
        {pendiente ? "Registrando el pedido…" : `Pedir tarjeta impresa · ${priceLabel}`}
      </button>
      {error ? (
        <p className="text-xs text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
