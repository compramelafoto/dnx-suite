"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AccionDelSobre, ActorDelSobre } from "@/lib/print-batches/entrega-del-pedido";
import type { DondeRetirar } from "@/lib/print-batches/sobre-del-pedido";

type Props = {
  codigo: string;
  actor: ActorDelSobre;
  acciones: AccionDelSobre[];
  fotografo: string;
  cliente: string;
  pedido: number | null;
  album: string | null;
  status: string;
  textoDelEstado: string;
  retiraCliente: boolean;
  dondeRetirar: DondeRetirar | null;
};

const TEXTO_BOTON: Record<AccionDelSobre, string> = {
  LISTO: "Listo para retirar (avisa al cliente)",
  ENTREGADO: "Marcar entregado",
  RECIBIDO_POR_CLIENTE: "Confirmar que lo recibí",
};

const TEXTO_HECHO: Record<AccionDelSobre, string> = {
  LISTO: "Listo: quedó «Listo para retirar» y le avisamos al cliente.",
  ENTREGADO: "Listo: quedó «Entregado».",
  RECIBIDO_POR_CLIENTE: "¡Gracias! Quedó registrado que lo recibiste.",
};

export default function EntregaDelSobre(p: Props) {
  const router = useRouter();
  const [enviando, setEnviando] = useState<AccionDelSobre | null>(null);
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const esLab = p.actor === "LAB_ENLACE" || p.actor === "LAB_CUENTA";
  const entregado = p.status === "DELIVERED" || p.status === "RETIRED";

  async function hacer(accion: AccionDelSobre) {
    setEnviando(accion);
    setMensaje(null);
    try {
      const r = await fetch(`/api/pedido/entrega/${encodeURIComponent(p.codigo)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion }),
      });
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) throw new Error(d.error || "No se pudo actualizar el pedido.");
      setMensaje({ tono: "ok", texto: TEXTO_HECHO[accion] });
      router.refresh();
    } catch (e) {
      setMensaje({ tono: "error", texto: e instanceof Error ? e.message : "No se pudo actualizar el pedido." });
    } finally {
      setEnviando(null);
    }
  }

  const botonPrincipal =
    "w-full rounded-xl bg-[#c27b3d] px-4 py-5 text-lg font-semibold text-white shadow-sm hover:bg-[#b06c31] disabled:opacity-60";
  const botonSecundario =
    "w-full rounded-xl border-2 border-[#c27b3d] px-4 py-4 text-base font-semibold text-[#c27b3d] hover:bg-[#c27b3d]/5 disabled:opacity-60";

  return (
    <div className="min-h-screen bg-[#f9fafb] px-4 py-8">
      <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="mb-1 text-xs uppercase tracking-wide text-gray-500">
          {p.pedido ? `Pedido #${p.pedido}` : "Pedido"} · {p.fotografo}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">
          {esLab && p.acciones.includes("ENTREGADO") ? `Entregar a ${p.cliente}` : p.cliente}
        </h1>
        {p.album ? <p className="mt-1 text-sm text-gray-600">{p.album}</p> : null}

        <div className={`mt-4 rounded-xl px-4 py-3 ${entregado ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>
          <p className="text-xs uppercase tracking-wide opacity-70">Estado</p>
          <p className="text-lg font-semibold">{entregado ? `${p.textoDelEstado} ✓` : p.textoDelEstado}</p>
        </div>

        {esLab && p.retiraCliente && !entregado ? (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            PAGADO — no cobrar al cliente; lo factura el fotógrafo.
          </p>
        ) : null}

        {p.retiraCliente && p.dondeRetirar && !esLab ? (
          <div className="mt-4 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
            <p className="text-xs uppercase tracking-wide text-gray-500">Dónde retirar</p>
            <p className="mt-1 font-semibold text-gray-900">{p.dondeRetirar.nombre}</p>
            {p.dondeRetirar.direccion ? <p>{p.dondeRetirar.direccion}</p> : null}
            {p.dondeRetirar.horario ? <p>Horario: {p.dondeRetirar.horario}</p> : null}
            <p className="mt-1 text-gray-500">Ya está pago: no tenés que abonar nada al retirar.</p>
          </div>
        ) : null}

        {mensaje ? (
          <p
            role="status"
            className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium ${mensaje.tono === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}
          >
            {mensaje.texto}
          </p>
        ) : null}

        {p.acciones.length ? (
          <div className="mt-5 space-y-3">
            {p.acciones.includes("LISTO") ? (
              <button type="button" disabled={enviando !== null} onClick={() => void hacer("LISTO")} className={botonSecundario}>
                {enviando === "LISTO" ? "Guardando…" : TEXTO_BOTON.LISTO}
              </button>
            ) : null}
            {p.acciones.includes("ENTREGADO") ? (
              <button type="button" disabled={enviando !== null} onClick={() => void hacer("ENTREGADO")} className={botonPrincipal}>
                {enviando === "ENTREGADO" ? "Guardando…" : TEXTO_BOTON.ENTREGADO}
              </button>
            ) : null}
            {p.acciones.includes("RECIBIDO_POR_CLIENTE") ? (
              <button type="button" disabled={enviando !== null} onClick={() => void hacer("RECIBIDO_POR_CLIENTE")} className={botonPrincipal}>
                {enviando === "RECIBIDO_POR_CLIENTE" ? "Guardando…" : TEXTO_BOTON.RECIBIDO_POR_CLIENTE}
              </button>
            ) : null}
          </div>
        ) : !entregado && p.actor === "ANONIMO" ? (
          <p className="mt-5 text-sm text-gray-500">
            {p.retiraCliente
              ? "Cuando esté listo para retirar te avisamos por correo. Al retirarlo, vas a poder confirmar acá que lo recibiste."
              : "Cuando esté listo, el fotógrafo te avisa por correo cómo retirarlo."}
          </p>
        ) : !entregado && esLab ? (
          <p className="mt-5 text-sm text-gray-500">Este pedido lo retira el fotógrafo: no se entrega en el laboratorio.</p>
        ) : null}
      </div>
    </div>
  );
}
