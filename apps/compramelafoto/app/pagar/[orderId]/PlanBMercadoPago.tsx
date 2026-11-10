"use client";

import { useState } from "react";
import { pasarPedidoACheckoutPro } from "@/lib/split-1n-piloto/plan-b";

/**
 * «Pagar con Mercado Pago»: el mismo pedido pasa al cobro de siempre (Checkout Pro). El
 * servidor sólo lo permite si no hay un cobro con tarjeta en curso.
 */
export default function PlanBMercadoPago({
  pedidoId,
  destacado,
  texto = "Pagar con Mercado Pago",
}: {
  pedidoId: number;
  /** Después de un error de la tarjeta se muestra como botón principal. */
  destacado: boolean;
  texto?: string;
}) {
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ir() {
    if (yendo) return;
    setYendo(true);
    setError(null);
    try {
      const r = await pasarPedidoACheckoutPro({ pedidoId });
      if (r.ok) {
        window.location.href = r.initPoint;
        return;
      }
      setError(r.mensaje);
    } catch {
      setError("No pudimos abrir Mercado Pago. Probá de nuevo en unos minutos.");
    }
    setYendo(false);
  }

  return (
    <div className="space-y-2 text-center">
      <button
        type="button"
        onClick={ir}
        disabled={yendo}
        className={
          destacado
            ? "w-full rounded-lg px-5 py-3 font-semibold text-white disabled:opacity-60"
            : "text-sm text-neutral-700 underline disabled:opacity-60"
        }
        style={destacado ? { backgroundColor: "#009EE3" } : undefined}
      >
        {yendo ? "Abriendo Mercado Pago…" : texto}
      </button>
      {!destacado ? (
        <p className="text-xs text-neutral-500">Con dinero en cuenta u otros medios de Mercado Pago.</p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
