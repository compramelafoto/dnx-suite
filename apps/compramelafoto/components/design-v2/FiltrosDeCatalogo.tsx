"use client";

import { useMemo, useState } from "react";
import {
  FILTROS_VACIOS,
  hayFiltros,
  opcionesDeFiltros,
  type FiltrosDeCatalogo as Filtros,
  type RasgosDePlantilla,
} from "@/lib/design-v2/rasgos-de-plantilla";

/**
 * Filtros del catálogo de plantillas: buscador (nombre o etiqueta) y desplegables por nivel,
 * evento, estilo, orientación, cantidad de fotos, listado y logo. Se combinan entre sí. Cada
 * desplegable sólo ofrece valores que existen en el catálogo; si no hay ninguno, no se muestra.
 * En el celular los desplegables se pliegan detrás de un botón «Filtros».
 */
export default function FiltrosDeCatalogo({
  items,
  filtros,
  onChange,
  cantidad,
}: {
  items: Array<{ rasgos: RasgosDePlantilla }>;
  filtros: Filtros;
  onChange: (f: Filtros) => void;
  /** Cuántas quedan con los filtros puestos. */
  cantidad: number;
}) {
  const op = useMemo(() => opcionesDeFiltros(items), [items]);
  const [abiertos, setAbiertos] = useState(false);
  const activos = Object.entries(filtros).filter(([k, v]) => k !== "texto" && v !== "").length;
  const poner = <K extends keyof Filtros>(k: K, v: Filtros[K]) => onChange({ ...filtros, [k]: v });

  const select = (
    etiqueta: string,
    valor: string,
    alCambiar: (v: string) => void,
    opciones: Array<{ v: string; t: string }>,
  ) =>
    opciones.length === 0 ? null : (
      <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-[#475569]">
        {etiqueta}
        <select
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          className={`h-10 w-full min-w-0 rounded-lg border bg-white px-2 text-sm text-[#0f172a] ${
            valor ? "border-[#c27b3d] ring-1 ring-[#c27b3d]/40" : "border-[#e2e8f0]"
          }`}
        >
          <option value="">Todos</option>
          {opciones.map((o) => (
            <option key={o.v} value={o.v}>
              {o.t}
            </option>
          ))}
        </select>
      </label>
    );

  const siNo = [
    { v: "si", t: "Con" },
    { v: "no", t: "Sin" },
  ];

  return (
    <div className="mb-5 rounded-xl border border-[#eef2f6] bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={filtros.texto}
          onChange={(e) => poner("texto", e.target.value)}
          placeholder="Buscar por nombre o etiqueta…"
          aria-label="Buscar plantillas por nombre o etiqueta"
          className="h-10 min-w-0 flex-1 rounded-lg border border-[#e2e8f0] px-3 text-sm text-[#0f172a] placeholder:text-[#94a3b8]"
        />
        <button
          type="button"
          onClick={() => setAbiertos((a) => !a)}
          aria-expanded={abiertos}
          className="h-10 rounded-lg border border-[#e2e8f0] px-3 text-sm font-semibold text-[#334155] sm:hidden"
        >
          Filtros{activos ? ` (${activos})` : ""}
        </button>
      </div>
      <div className={`${abiertos ? "grid" : "hidden"} mt-3 grid-cols-2 gap-3 sm:grid sm:grid-cols-4 lg:grid-cols-7`}>
        {select("Nivel", filtros.categoria, (v) => poner("categoria", v), op.categorias.map((c) => ({ v: c, t: c })))}
        {select("Evento", filtros.evento, (v) => poner("evento", v), op.eventos.map((c) => ({ v: c, t: c })))}
        {select("Estilo", filtros.estilo, (v) => poner("estilo", v), op.estilos.map((c) => ({ v: c, t: c })))}
        {select(
          "Orientación",
          filtros.orientacion,
          (v) => poner("orientacion", v as Filtros["orientacion"]),
          op.orientaciones.map((o) => ({ v: o, t: o === "vertical" ? "Vertical" : "Horizontal" })),
        )}
        {select(
          "Fotos",
          filtros.cantidadFotos,
          (v) => poner("cantidadFotos", v),
          op.cantidades.map((n) => ({ v: String(n), t: n === 1 ? "1 foto" : `${n} fotos` })),
        )}
        {select("Listado del curso", filtros.listado, (v) => poner("listado", v as Filtros["listado"]), siNo)}
        {select("Logo del colegio", filtros.logo, (v) => poner("logo", v as Filtros["logo"]), siNo)}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="m-0 text-[#475569]" aria-live="polite">
          {cantidad === items.length
            ? `${items.length} ${items.length === 1 ? "plantilla" : "plantillas"}`
            : `${cantidad} de ${items.length} plantillas`}
        </p>
        {hayFiltros(filtros) ? (
          <button
            type="button"
            onClick={() => onChange(FILTROS_VACIOS)}
            className="font-semibold text-[#c27b3d] underline underline-offset-2"
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>
    </div>
  );
}
