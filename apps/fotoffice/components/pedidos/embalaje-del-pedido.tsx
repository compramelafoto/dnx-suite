"use client";

import { useState, useTransition } from "react";
import { cambiarEmbalajePedidoAction } from "@/app/actions/pedidos";

type Elegido = { insumoId: string; qty: number };

/**
 * Los sobres y bolsas que descontó el pedido, con «Cambiar». Sirve, por ejemplo, para sumar el sobre
 * de una segunda entrega o corregir una bolsa.
 */
export function EmbalajeDelPedido({
  pedidoId,
  actual,
  opciones,
  puedeEditar,
}: {
  pedidoId: string;
  actual: Elegido[];
  opciones: { insumoId: string; nombre: string }[];
  puedeEditar: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [cantidades, setCantidades] = useState<Record<string, number>>(() => Object.fromEntries(actual.map((e) => [e.insumoId, e.qty])));
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const nombre = new Map(opciones.map((o) => [o.insumoId, o.nombre]));
  const texto = actual.length > 0 ? actual.map((e) => `${e.qty} ${nombre.get(e.insumoId) ?? "envoltorio inactivo"}`).join(" + ") : "Nada";

  if (!editando) {
    return (
      <p className="text-sm text-[var(--fo-muted)]">
        <span className="text-[var(--fo-text)]">{texto}</span>
        {puedeEditar ? (
          <>
            {" "}·{" "}
            <button type="button" className="underline hover:text-[var(--fo-text)]" onClick={() => setEditando(true)}>
              Cambiar
            </button>
          </>
        ) : null}
      </p>
    );
  }

  function guardar() {
    setError(null);
    iniciar(async () => {
      const r = await cambiarEmbalajePedidoAction({
        pedidoId,
        deseado: Object.entries(cantidades).map(([insumoId, qty]) => ({ insumoId, qty })),
      });
      if (r.ok) setEditando(false);
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-2 text-sm">
      {opciones.map((o) => (
        <label key={o.insumoId} className="flex items-center justify-between gap-2">
          <span className="text-[var(--fo-text)]">{o.nombre}</span>
          <input
            type="number"
            min={0}
            max={999}
            className="fo-input h-8 w-20 text-right"
            value={cantidades[o.insumoId] ?? 0}
            onChange={(e) => setCantidades((c) => ({ ...c, [o.insumoId]: Math.max(0, Math.min(999, Math.trunc(Number(e.target.value)) || 0)) }))}
            aria-label={`Cantidad de ${o.nombre}`}
          />
        </label>
      ))}
      {error ? (
        <p className="text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" className="fo-btn text-sm" onClick={() => setEditando(false)} disabled={pendiente}>
          Cancelar
        </button>
        <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={guardar} disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
