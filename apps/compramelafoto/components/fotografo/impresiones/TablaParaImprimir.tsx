"use client";

import { Fragment } from "react";
import {
  agruparParaImprimir,
  fechaDelPanel,
  textoDeCopiasDelPanel,
  type LaboratorioDelPanel,
  type PedidoDelPanel,
} from "@/lib/print-batches/panel";

type Props = {
  pedidos: PedidoDelPanel[];
  laboratorios: LaboratorioDelPanel[];
  seleccion: Set<number>;
  onCambiarSeleccion: (ids: Set<number>) => void;
  deshabilitada: boolean;
};

const CASILLA = "h-4 w-4 accent-[#c27b3d]";

/**
 * «Para imprimir» como tabla, igual que «Pedidos escolares»: una casilla por pedido y, si hay
 * pedidos que se retiran en distintos laboratorios, un subtítulo por laboratorio con «Elegir todos»
 * (un lote va a un solo laboratorio).
 */
export default function TablaParaImprimir({ pedidos, laboratorios, seleccion, onCambiarSeleccion, deshabilitada }: Props) {
  const grupos = agruparParaImprimir(pedidos, laboratorios);
  const variosGrupos = grupos.length > 1 || grupos[0]?.labContactId != null;
  const habilitados = (ps: PedidoDelPanel[]) => ps.filter((p) => p.motivo == null).map((p) => p.albumOrderId);
  const todos = habilitados(pedidos);
  const todosElegidos = todos.length > 0 && todos.every((id) => seleccion.has(id));

  function alternar(id: number) {
    const nueva = new Set(seleccion);
    if (nueva.has(id)) nueva.delete(id);
    else nueva.add(id);
    onCambiarSeleccion(nueva);
  }

  function elegirVarios(ids: number[]) {
    const yaEstan = ids.every((id) => seleccion.has(id));
    const nueva = new Set(seleccion);
    for (const id of ids) {
      if (yaEstan) nueva.delete(id);
      else nueva.add(id);
    }
    onCambiarSeleccion(nueva);
  }

  return (
    <div className="ds-table-scroll overflow-x-auto rounded-xl border border-gray-100 bg-white">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="w-10 py-3 px-3">
              {variosGrupos ? null : (
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos"
                  disabled={deshabilitada || todos.length === 0}
                  checked={todosElegidos}
                  onChange={() => elegirVarios(todos)}
                  className={CASILLA}
                />
              )}
            </th>
            <th className="text-left py-3 px-3 font-medium">Pedido</th>
            <th className="text-left py-3 px-3 font-medium">Álbum</th>
            <th className="text-left py-3 px-3 font-medium">Copias</th>
            <th className="text-left py-3 px-3 font-medium">Pagó</th>
            <th className="text-left py-3 px-3 font-medium">Entrega</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => {
            const delGrupo = habilitados(g.pedidos);
            return (
              <Fragment key={g.labContactId ?? "sin"}>
                {variosGrupos ? (
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <td className="py-2 px-3">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar todos: ${g.titulo}`}
                        disabled={deshabilitada || delGrupo.length === 0}
                        checked={delGrupo.length > 0 && delGrupo.every((id) => seleccion.has(id))}
                        onChange={() => elegirVarios(delGrupo)}
                        className={CASILLA}
                      />
                    </td>
                    <td colSpan={5} className="py-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {g.titulo}
                    </td>
                  </tr>
                ) : null}
                {g.pedidos.map((p) => {
                  const gris = p.motivo != null;
                  const elegido = seleccion.has(p.albumOrderId);
                  return (
                    <tr
                      key={p.albumOrderId}
                      className={`border-b border-gray-100 align-top ${gris ? "text-gray-400" : elegido ? "bg-[#c27b3d]/5" : "hover:bg-gray-50"}`}
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar el pedido #${p.albumOrderId}`}
                          disabled={gris || deshabilitada}
                          checked={elegido}
                          onChange={() => alternar(p.albumOrderId)}
                          className={CASILLA}
                        />
                      </td>
                      <td className="py-3 px-3">
                        <span className={gris ? "font-medium" : "font-medium text-gray-900"}>{p.cliente}</span>
                        <div className="text-xs text-gray-500">Pedido #{p.albumOrderId}</div>
                        {p.motivo ? <div className="text-xs italic">{p.motivo}</div> : null}
                      </td>
                      <td className="py-3 px-3">{p.album}</td>
                      <td className="py-3 px-3">{textoDeCopiasDelPanel(p.copias)}</td>
                      <td className="py-3 px-3 whitespace-nowrap">{fechaDelPanel(p.pagadoAt)}</td>
                      <td className="py-3 px-3">{p.retiraCliente ? "Retira el cliente en el laboratorio" : "La entregás vos"}</td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
