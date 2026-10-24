"use client";

import { useState } from "react";
import { isPreventaUxV2EnabledClient } from "@/lib/preventa-canjeable/preventa-ux-v2-feature-flag";

type Props = {
  orderId: number;
  preCompraOrderId: number | null;
  totalPesos: number;
  concepto: string;
  vendedor: string;
  volverA: string;
};

const pesos = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });

export default function PagoSimuladoClient({ orderId, preCompraOrderId, totalPesos, concepto, vendedor, volverA }: Props) {
  const [estado, setEstado] = useState<"elegir" | "procesando" | "aprobado" | "rechazado">("elegir");
  const [error, setError] = useState<string | null>(null);

  async function simular(result: "approved" | "rejected") {
    setEstado("procesando");
    setError(null);
    try {
      const res = await fetch("/api/payments/simulated/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, result }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo procesar el pago.");
      if (result === "rejected") {
        setEstado("rechazado");
        return;
      }
      setEstado("aprobado");
      // Mismo camino que la vuelta de un pago real (`/pago/success`).
      const destino =
        data.packAccessUrl && isPreventaUxV2EnabledClient()
          ? data.packAccessUrl
          : preCompraOrderId
            ? `/order/${preCompraOrderId}/selfies`
            : data.packAccessUrl || volverA;
      window.setTimeout(() => {
        window.location.href = destino;
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setEstado("elegir");
    }
  }

  return (
    <div className="min-h-screen bg-[#eeeeee] py-10">
      <div className="mx-auto max-w-md px-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-lg font-bold text-[#2d3277]">Pago seguro</span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Simulación</span>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Pagás a {vendedor}</p>
          <p className="mt-1 text-base text-gray-800">{concepto}</p>
          <p className="mt-4 text-4xl font-light text-gray-900">{pesos(totalPesos)} pesos</p>

          {estado === "aprobado" ? (
            <div className="mt-6 rounded-lg bg-[#00a650]/10 p-4 text-center">
              <p className="text-2xl">✓</p>
              <p className="mt-1 font-semibold text-[#00a650]">¡Listo! Se acreditó tu pago</p>
              <p className="mt-1 text-sm text-gray-600">Te llevamos a tu compra…</p>
            </div>
          ) : estado === "rechazado" ? (
            <div className="mt-6 rounded-lg bg-red-50 p-4 text-center">
              <p className="font-semibold text-red-700">El pago fue rechazado</p>
              <a href={volverA} className="mt-2 inline-block text-sm text-[#009ee3] underline">
                Volver a intentar
              </a>
            </div>
          ) : (
            <>
              <div className="mt-6 space-y-2">
                <div className="flex items-center gap-3 rounded-lg border border-[#009ee3] bg-[#009ee3]/5 p-3">
                  <span className="text-xl">💳</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Tarjeta de prueba</p>
                    <p className="text-xs text-gray-500">Visa terminada en 4242 · 1 cuota sin interés</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => simular("approved")}
                disabled={estado === "procesando"}
                className="mt-6 w-full rounded-lg bg-[#009ee3] py-3 text-base font-semibold text-white hover:bg-[#0087c2] disabled:opacity-60"
              >
                {estado === "procesando" ? "Procesando…" : "Pagar"}
              </button>
              <button
                type="button"
                onClick={() => simular("rejected")}
                disabled={estado === "procesando"}
                className="mt-2 w-full rounded-lg py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Simular un pago rechazado
              </button>
            </>
          )}
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </div>
        <p className="mt-4 text-center text-xs text-gray-500">
          Demo: este pago es simulado. No se cobra nada ni se usa ninguna tarjeta real.
        </p>
      </div>
    </div>
  );
}
