"use client";

import { useState } from "react";
import { pasarPedidoACheckoutPro } from "@/lib/split-1n-piloto/plan-b";
import { pagarGrupoConMercadoPago } from "@/lib/split-1n-carrito-evento/mercado-pago-grupo";

/**
 * «Pagar con Mercado Pago»: el pedido de un álbum (`pedidoId`) o el carrito de un evento
 * (`grupoId`) va a Checkout Pro. El servidor sólo lo permite si no hay un cobro con tarjeta en
 * curso.
 */
export default function PlanBMercadoPago({
  pedidoId,
  grupoId,
  destacado,
  texto = "Pagar con Mercado Pago",
}: {
  /** Uno de los dos. */
  pedidoId?: number;
  grupoId?: string;
  /** Botón principal (azul de Mercado Pago); si no, enlace discreto. */
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
      const r = grupoId
        ? await pagarGrupoConMercadoPago({ grupoId })
        : await pasarPedidoACheckoutPro({ pedidoId: pedidoId ?? 0 });
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
            ? "w-full rounded-lg px-5 py-4 text-lg font-semibold text-white shadow-sm transition hover:brightness-95 disabled:opacity-60"
            : "text-sm text-neutral-700 underline disabled:opacity-60"
        }
        style={destacado ? { backgroundColor: "#009EE3" } : undefined}
      >
        {yendo ? "Abriendo Mercado Pago…" : texto}
      </button>
      <p className="text-xs text-neutral-500">
        Con dinero en cuenta, tarjetas guardadas, débito o crédito.
      </p>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
