"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { anularCobroAction } from "@/app/actions/pedidos";
import { fechaHoraBA } from "@/lib/ficha/formato";
import type { OpcionesEnvioPedido } from "@/lib/pedidos/envio";
import { pesosPedido } from "@/lib/pedidos/pantalla";
import { EnviarPedido } from "./enviar-pedido";
import { Imprimir } from "./registrar-cobro";

/** Un cobro tal como lo ve la ficha (sin datos de Caja). */
export type CobroVista = {
  id: string;
  numero: string;
  /** ISO. */
  fecha: string;
  medio: string;
  importe: number;
  anulado: boolean;
  motivo: string | null;
  comprobante: string | null;
};

const MAX_MOTIVO = 1000;

/**
 * Cobros y recibos del pedido: número, fecha, medio, importe y estado. Cada recibo se puede abrir
 * para imprimir (con "Ver"); con "Gestionar", mandarlo por correo o WhatsApp y anular el cobro con
 * motivo (genera el contramovimiento en Caja; el recibo queda marcado ANULADO, nunca se borra).
 */
export function CobrosDelPedido({
  pedidoId,
  cobros,
  gestiona,
  envio,
}: {
  pedidoId: string;
  cobros: CobroVista[];
  gestiona: boolean;
  envio: OpcionesEnvioPedido | null;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [anulando, setAnulando] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  function anular(e: React.FormEvent, cobroId: string) {
    e.preventDefault();
    if (!motivo.trim()) return setError("Escribí el motivo de la anulación.");
    setError(null);
    iniciar(async () => {
      const r = await anularCobroAction({ cobroId, motivo }).catch(() => ({ ok: false as const, error: "No se pudo anular. Probá de nuevo." }));
      if (r.ok) {
        setAnulando(null);
        setMotivo("");
        router.refresh();
      } else setError(r.error);
    });
  }

  if (cobros.length === 0) return <p className="text-sm text-[var(--fo-muted)]">Todavía no hay cobros.</p>;
  return (
    <ul className="divide-y divide-[var(--fo-border)] text-sm">
      {cobros.map((c) => (
        <li key={c.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-medium text-[var(--fo-text)]">
              Recibo N° {c.numero}
              {c.anulado ? (
                <span className="ml-2 rounded-full bg-[var(--fo-danger-soft)] px-2 py-0.5 text-xs font-medium text-[var(--fo-danger)]">ANULADO</span>
              ) : null}
            </span>
            <span className={`tabular-nums ${c.anulado ? "text-[var(--fo-muted)] line-through" : "text-[var(--fo-text)]"}`}>{pesosPedido(c.importe)}</span>
          </div>
          <p className="text-xs text-[var(--fo-muted)]">
            {fechaHoraBA(c.fecha)} · {c.medio}
            {c.comprobante ? ` · Comprobante: ${c.comprobante}` : ""}
          </p>
          {c.anulado && c.motivo ? <p className="text-xs text-[var(--fo-muted)]">Motivo de la anulación: {c.motivo}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <Imprimir cobroId={c.id} etiqueta="Ver recibo" clase="fo-btn fo-btn-ghost text-xs" />
            {gestiona && envio && !c.anulado ? (
              <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setEnviando(enviando === c.id ? null : c.id)} aria-expanded={enviando === c.id}>
                Enviar el recibo
              </button>
            ) : null}
            {gestiona && !c.anulado ? (
              <button
                type="button"
                className="fo-btn fo-btn-danger-outline text-xs"
                onClick={() => {
                  setAnulando(anulando === c.id ? null : c.id);
                  setMotivo("");
                  setError(null);
                }}
                aria-expanded={anulando === c.id}
              >
                Anular cobro
              </button>
            ) : null}
          </div>
          {enviando === c.id && envio ? <EnviarPedido pedidoId={pedidoId} opciones={envio} cobroId={c.id} compacto /> : null}
          {anulando === c.id ? (
            <form onSubmit={(e) => anular(e, c.id)} className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3">
              <label className="block space-y-1">
                <span className="text-xs text-[var(--fo-muted)]">Motivo (obligatorio)</span>
                <textarea className="fo-input w-full" value={motivo} maxLength={MAX_MOTIVO} onChange={(e) => setMotivo(e.target.value)} required />
              </label>
              <p className="text-xs text-[var(--fo-muted)]">Se hace el contramovimiento en Caja y el recibo queda marcado ANULADO.</p>
              {error ? (
                <p role="alert" className="text-sm text-[var(--fo-danger)]">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="fo-btn fo-btn-danger-outline text-sm" disabled={pendiente}>
                  {pendiente ? "Anulando…" : "Anular cobro"}
                </button>
                <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setAnulando(null)} disabled={pendiente}>
                  Cancelar
                </button>
              </div>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
