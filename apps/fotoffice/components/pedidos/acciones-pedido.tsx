"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cambiarEstadoPedidoAction, cambiarRubroPedidoAction, enlaceDelPedidoAction } from "@/app/actions/pedidos";
import { ETIQUETA_ESTADO_PEDIDO, type EstadoPedido } from "@/lib/pedidos/constantes";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";
const MAX_MOTIVO = 1000;

const VERBO: Record<EstadoPedido, string> = {
  CONFIRMADO: "Volver a confirmado",
  EN_CURSO: "Pasar a en curso",
  COMPLETADO: "Marcar completado",
  CANCELADO: "Cancelar pedido",
};

/**
 * Acciones del pedido (con "Gestionar"): "Cambiar estado" (cancelar pide motivo), "Copiar enlace
 * del cliente" (lo crea la primera vez) y el rubro de ingreso. Las reglas las vuelve a mirar el
 * servidor.
 */
export function AccionesPedido({
  pedidoId,
  siguientes,
  rubros,
  rubroActual,
  cancelado,
}: {
  pedidoId: string;
  siguientes: readonly EstadoPedido[];
  rubros: { id: string; nombre: string }[];
  rubroActual: string | null;
  cancelado: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enlace, setEnlace] = useState<string | null>(null);

  function correr(accion: () => Promise<{ ok: true } | { ok: false; error: string }>, luego?: () => void) {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const r = await accion().catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (r.ok) {
        luego?.();
        router.refresh();
      } else setError(r.error);
    });
  }

  function copiarEnlace() {
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const r = await enlaceDelPedidoAction({ pedidoId }).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      setEnlace(r.url);
      try {
        await navigator.clipboard.writeText(r.url);
        setAviso("Enlace copiado.");
      } catch {
        setAviso("Copiá el enlace de acá abajo.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {siguientes
          .filter((e) => e !== "CANCELADO")
          .map((e) => (
            <button
              key={e}
              type="button"
              className="fo-btn fo-btn-secondary text-sm"
              disabled={pendiente}
              onClick={() => correr(() => cambiarEstadoPedidoAction({ pedidoId, estado: e }))}
            >
              {VERBO[e]}
            </button>
          ))}
        <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={copiarEnlace}>
          Copiar enlace del cliente
        </button>
        {siguientes.includes("CANCELADO") ? (
          <button
            type="button"
            className="fo-btn fo-btn-danger-outline text-sm"
            disabled={pendiente}
            onClick={() => {
              setCancelando((v) => !v);
              setMotivo("");
            }}
            aria-expanded={cancelando}
          >
            {VERBO.CANCELADO}
          </button>
        ) : null}
        {!cancelado && rubros.length > 0 ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-xs text-[var(--fo-muted)]">Rubro de ingreso</span>
            <select
              className="fo-input"
              value={rubroActual ?? ""}
              disabled={pendiente}
              onChange={(e) => {
                if (e.target.value) correr(() => cambiarRubroPedidoAction({ pedidoId, categoryId: e.target.value }));
              }}
            >
              {rubroActual ? null : <option value="">Sin rubro</option>}
              {rubros.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {cancelando ? (
        <form
          className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!motivo.trim()) return setError("Para cancelar el pedido escribí el motivo.");
            correr(() => cambiarEstadoPedidoAction({ pedidoId, estado: "CANCELADO", motivo }), () => setCancelando(false));
          }}
        >
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-[var(--fo-muted)]">Motivo (obligatorio)</span>
            <textarea className="fo-input w-full" value={motivo} maxLength={MAX_MOTIVO} onChange={(e) => setMotivo(e.target.value)} required />
          </label>
          <p className="text-xs text-[var(--fo-muted)]">
            Las cuotas pendientes quedan canceladas. Los cobros hechos quedan; si hay que devolver dinero, anulá el cobro.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="fo-btn fo-btn-danger-outline text-sm" disabled={pendiente}>
              Pasar a {ETIQUETA_ESTADO_PEDIDO.CANCELADO.toLowerCase()}
            </button>
            <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setCancelando(false)} disabled={pendiente}>
              No cancelar
            </button>
          </div>
        </form>
      ) : null}

      {enlace ? <p className="break-all text-xs text-[var(--fo-muted)]">{enlace}</p> : null}
      {aviso ? (
        <p role="status" className="text-sm text-[var(--fo-muted)]">
          {aviso}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
