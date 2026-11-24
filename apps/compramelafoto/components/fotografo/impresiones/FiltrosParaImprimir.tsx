"use client";

import { useState } from "react";
import {
  FILTRO_VACIO,
  filtrosActivos,
  opcionesDelFiltro,
  type FiltroParaImprimir,
} from "@/lib/print-batches/filtro-para-imprimir";
import type { LaboratorioDelPanel, PedidoDelPanel } from "@/lib/print-batches/panel";

type Props = {
  pedidos: PedidoDelPanel[];
  laboratorios: LaboratorioDelPanel[];
  filtro: FiltroParaImprimir;
  onCambiar: (f: FiltroParaImprimir) => void;
  mostrados: number;
};

const CAMPO = "rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:border-[#c27b3d] focus:outline-none";
const ETIQUETA = "flex flex-col gap-1 text-xs font-medium text-gray-600";

/** Buscador y filtros arriba de la tabla «Para imprimir». El buscador va siempre; el resto se despliega. */
export default function FiltrosParaImprimir({ pedidos, laboratorios, filtro, onCambiar, mostrados }: Props) {
  const [abiertos, setAbiertos] = useState(false);
  const { albumes, medidas } = opcionesDelFiltro(pedidos);
  const activos = filtrosActivos(filtro);
  const otros = activos - (filtro.texto.trim() ? 1 : 0);
  const poner = <K extends keyof FiltroParaImprimir>(k: K, v: FiltroParaImprimir[K]) => onCambiar({ ...filtro, [k]: v });
  const conRetiro = laboratorios.filter((l) => pedidos.some((p) => p.pickupLabContactId === l.id));

  return (
    <div className="space-y-3 rounded-xl border border-gray-100 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">⌕</span>
          <input
            type="search"
            value={filtro.texto}
            onChange={(ev) => poner("texto", ev.target.value)}
            placeholder="Buscar por cliente, correo, teléfono, n.º de pedido, álbum o medida…"
            aria-label="Buscar pedidos para imprimir"
            className={`${CAMPO} w-full pl-8`}
          />
        </div>
        <button
          type="button"
          onClick={() => setAbiertos((a) => !a)}
          aria-expanded={abiertos}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Filtros{otros > 0 ? ` (${otros})` : ""} {abiertos ? "▴" : "▾"}
        </button>
        <label className="inline-flex items-center gap-1.5 text-sm text-gray-700">
          Ordenar
          <select value={filtro.orden} onChange={(ev) => poner("orden", ev.target.value as FiltroParaImprimir["orden"])} className={CAMPO}>
            <option value="MAS_VIEJOS">Pagados hace más tiempo</option>
            <option value="MAS_NUEVOS">Pagados más recientes</option>
            <option value="CLIENTE">Cliente (A a Z)</option>
            <option value="MAS_COPIAS">Más copias primero</option>
          </select>
        </label>
      </div>

      {abiertos ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className={ETIQUETA}>
            Álbum
            <select value={filtro.album} onChange={(ev) => poner("album", ev.target.value)} className={CAMPO}>
              <option value="">Todos los álbumes</option>
              {albumes.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className={ETIQUETA}>
            Medida
            <select value={filtro.medida} onChange={(ev) => poner("medida", ev.target.value)} className={CAMPO}>
              <option value="">Todas las medidas</option>
              {medidas.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className={ETIQUETA}>
            Entrega
            <select value={filtro.entrega} onChange={(ev) => poner("entrega", ev.target.value as FiltroParaImprimir["entrega"])} className={CAMPO}>
              <option value="TODAS">Todas</option>
              <option value="LA_ENTREGAS_VOS">La entregás vos</option>
              <option value="RETIRA_EN_LAB">Retira el cliente en el laboratorio</option>
            </select>
          </label>
          {conRetiro.length ? (
            <label className={ETIQUETA}>
              Laboratorio de retiro
              <select value={filtro.laboratorio} onChange={(ev) => poner("laboratorio", ev.target.value)} className={CAMPO}>
                <option value="">Todos</option>
                <option value="SIN">Sin retiro en laboratorio</option>
                {conRetiro.map((l) => <option key={l.id} value={String(l.id)}>{l.nombre}</option>)}
              </select>
            </label>
          ) : null}
          <label className={ETIQUETA}>
            Estado
            <select value={filtro.estado} onChange={(ev) => poner("estado", ev.target.value as FiltroParaImprimir["estado"])} className={CAMPO}>
              <option value="TODOS">Todos</option>
              <option value="LISTOS">Se pueden imprimir</option>
              <option value="CON_PROBLEMA">Con algún problema</option>
            </select>
          </label>
          <label className={ETIQUETA}>
            Pagado desde
            <input type="date" value={filtro.desde} max={filtro.hasta || undefined} onChange={(ev) => poner("desde", ev.target.value)} className={CAMPO} />
          </label>
          <label className={ETIQUETA}>
            Pagado hasta
            <input type="date" value={filtro.hasta} min={filtro.desde || undefined} onChange={(ev) => poner("hasta", ev.target.value)} className={CAMPO} />
          </label>
        </div>
      ) : null}

      {activos > 0 ? (
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
          <span>
            Mostrando {mostrados} de {pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"}
          </span>
          <button type="button" onClick={() => onCambiar({ ...FILTRO_VACIO, orden: filtro.orden })} className="font-semibold text-[#c27b3d] hover:underline">
            Limpiar filtros
          </button>
        </div>
      ) : null}
    </div>
  );
}
