"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  agruparParaImprimir,
  fechaDelPanel,
  laboratorioDeLaSeleccion,
  textoDeCopiasDelPanel,
  type LaboratorioDelPanel,
  type PedidoDelPanel,
} from "@/lib/print-batches/panel";

type Props = {
  pedidos: PedidoDelPanel[];
  laboratorios: LaboratorioDelPanel[];
  seleccion: Set<number>;
  onCambiarSeleccion: (ids: Set<number>) => void;
  armando: boolean;
  onArmar: (albumOrderIds: number[], labContactId: number | null) => void;
  /** Lotes armados sin enviar: van arriba de los pedidos. */
  lotesArmados: ReactNode;
};

export default function ColumnaParaImprimir({ pedidos, laboratorios, seleccion, onCambiarSeleccion, armando, onArmar, lotesArmados }: Props) {
  const grupos = agruparParaImprimir(pedidos, laboratorios);
  const elegidos = pedidos.filter((p) => seleccion.has(p.albumOrderId));
  const lab = laboratorioDeLaSeleccion(elegidos);
  const variosGrupos = grupos.length > 1 || grupos[0]?.labContactId != null;

  function alternar(id: number) {
    const nueva = new Set(seleccion);
    if (nueva.has(id)) nueva.delete(id);
    else nueva.add(id);
    onCambiarSeleccion(nueva);
  }

  function elegirGrupo(ids: number[]) {
    const todos = ids.every((id) => seleccion.has(id));
    const nueva = new Set(seleccion);
    for (const id of ids) {
      if (todos) nueva.delete(id);
      else nueva.add(id);
    }
    onCambiarSeleccion(nueva);
  }

  return (
    <div className="space-y-3">
      {lotesArmados}

      {pedidos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-gray-500">
          No hay pedidos pagados con copias para imprimir.
        </p>
      ) : (
        <>
          {grupos.map((g) => {
            const habilitados = g.pedidos.filter((p) => p.motivo == null).map((p) => p.albumOrderId);
            return (
              <section key={g.labContactId ?? "sin"} className="space-y-1.5">
                {variosGrupos ? (
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{g.titulo}</h3>
                    {habilitados.length > 1 ? (
                      <button type="button" onClick={() => elegirGrupo(habilitados)} className="text-[11px] text-[#c27b3d] hover:underline">
                        {habilitados.every((id) => seleccion.has(id)) ? "Ninguno" : "Todos"}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <ul className="space-y-1.5">
                  {g.pedidos.map((p) => {
                    const gris = p.motivo != null;
                    return (
                      <li key={p.albumOrderId}>
                        <label
                          className={cn(
                            "flex items-start gap-2 rounded-lg border px-2.5 py-2",
                            gris ? "border-gray-100 bg-gray-50 text-gray-400" : "cursor-pointer border-gray-200 bg-white hover:border-[#c27b3d]/50",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            disabled={gris || armando}
                            checked={seleccion.has(p.albumOrderId)}
                            onChange={() => alternar(p.albumOrderId)}
                          />
                          <span className="min-w-0">
                            <span className={cn("block truncate text-xs font-medium", gris ? "text-gray-500" : "text-gray-900")}>
                              #{p.albumOrderId} {p.cliente}
                            </span>
                            <span className="block text-[11px]">{textoDeCopiasDelPanel(p.copias)}</span>
                            <span className="block text-[11px] text-gray-400">
                              {p.album} · pagado {fechaDelPanel(p.pagadoAt)}
                              {p.retiraCliente ? " · retira el cliente" : ""}
                            </span>
                            {p.motivo ? <span className="block text-[11px] italic">{p.motivo}</span> : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          <div className="sticky bottom-2 space-y-1.5 rounded-lg bg-white/95 p-2 shadow-sm ring-1 ring-gray-100">
            {!lab.ok ? <p className="text-[11px] text-red-700">{lab.error}</p> : null}
            <button
              type="button"
              disabled={armando || elegidos.length === 0 || !lab.ok}
              onClick={() => lab.ok && onArmar(elegidos.map((p) => p.albumOrderId), lab.labContactId)}
              className="w-full rounded-lg bg-[#c27b3d] px-3 py-2 text-xs font-semibold text-white hover:bg-[#b06a2f] disabled:opacity-50"
            >
              {armando ? "Armando…" : elegidos.length > 0 ? `Armar lote con ${elegidos.length} ${elegidos.length === 1 ? "pedido" : "pedidos"}` : "Elegí pedidos para armar un lote"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
