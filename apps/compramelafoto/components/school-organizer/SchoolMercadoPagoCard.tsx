"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Estado = { connected: boolean; status: string; updatedAt: string | null };

/**
 * Cuenta de Mercado Pago del colegio: con ella, el colegio recibe su parte de cada venta
 * directamente, a medida que las familias pagan. Se conecta con el mismo flujo que el fotógrafo.
 */
export default function SchoolMercadoPagoCard() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  async function cargar() {
    const res = await fetch("/api/mercadopago/connection-status?ownerType=USER", { credentials: "include", cache: "no-store" });
    if (res.ok) setEstado((await res.json()) as Estado);
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("mp_connected") === "true") setAviso("¡Listo! La cuenta de Mercado Pago quedó conectada.");
    else if (q.get("mp_error")) setAviso("No se pudo conectar Mercado Pago. Probá de nuevo.");
    void cargar();
  }, []);

  async function desconectar() {
    setTrabajando(true);
    try {
      await fetch("/api/mercadopago/disconnect?ownerType=USER", { method: "POST", credentials: "include" });
      setAviso(null);
      await cargar();
    } finally {
      setTrabajando(false);
    }
  }

  const conectada = Boolean(estado?.connected);
  const vencida = estado?.status === "EXPIRED";

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h2 className="font-semibold text-gray-900">Cobrar con Mercado Pago</h2>
          <p className="mt-1 text-sm text-gray-600">
            Si conectás la cuenta de Mercado Pago del colegio, la parte de cada venta que le corresponde a la escuela se
            acredita directamente en esa cuenta, a medida que las familias pagan.
          </p>
        </div>
        {estado == null ? null : conectada && !vencida ? (
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Conectada</span>
            <Button variant="secondary" size="sm" onClick={() => void desconectar()} disabled={trabajando}>
              {trabajando ? "Desconectando…" : "Desconectar"}
            </Button>
          </div>
        ) : (
          <a
            href="/api/mercadopago/oauth/start?ownerType=USER"
            className="inline-flex items-center rounded-lg bg-[#009ee3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0089c7]"
          >
            {vencida ? "Volver a conectar Mercado Pago" : "Conectar Mercado Pago"}
          </a>
        )}
      </div>
      {conectada && estado?.updatedAt ? (
        <p className="mt-2 text-xs text-gray-500">
          Conectada el {new Date(estado.updatedAt).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}.
        </p>
      ) : null}
      {aviso ? <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{aviso}</p> : null}
    </Card>
  );
}
