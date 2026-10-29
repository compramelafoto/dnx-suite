"use client";

import { useMemo, useState } from "react";
import {
  FILTROS_VACIOS,
  alternarOpcion,
  cantidadDeFiltros,
  hayFiltros,
  opcionesDeFiltros,
  type FiltrosDeCatalogo as Filtros,
  type RasgosDePlantilla,
} from "@/lib/design-v2/rasgos-de-plantilla";

type ClaveDeLista = Exclude<keyof Filtros, "texto">;

/**
 * Filtros del catálogo de plantillas: buscador (nombre o etiqueta) y casillas por tipo de
 * producto, nivel, evento, estilo, orientación, cantidad de fotos, listado, mosaico y logo. En un
 * mismo filtro se pueden tildar varias (Jardín y Primaria); los filtros se combinan entre sí.
 * Cada filtro sólo ofrece valores que existen en el catálogo, con cuántas plantillas tiene cada
 * uno; si no hay ninguno, no se muestra. En el celular se pliegan detrás de un botón «Filtros».
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
  const activos = cantidadDeFiltros(filtros);

  /** Cuántas plantillas del catálogo tienen cada valor de un rasgo. */
  const cuenta = useMemo(() => {
    const porRasgo = new Map<string, number>();
    const sumar = (k: string) => porRasgo.set(k, (porRasgo.get(k) ?? 0) + 1);
    for (const { rasgos: r } of items) {
      if (r.tipoProducto) sumar(`tipoProducto:${r.tipoProducto}`);
      if (r.categoria) sumar(`categoria:${r.categoria}`);
      if (r.evento) sumar(`evento:${r.evento}`);
      if (r.estilo) sumar(`estilo:${r.estilo}`);
      sumar(`orientacion:${r.orientacion}`);
      sumar(`cantidadFotos:${r.cantidadFotos}`);
      sumar(`listado:${r.conListado ? "si" : "no"}`);
      sumar(`mosaico:${r.conMosaico ? "si" : "no"}`);
      sumar(`logo:${r.conLogo ? "si" : "no"}`);
    }
    return porRasgo;
  }, [items]);

  const grupo = <K extends ClaveDeLista>(
    titulo: string,
    k: K,
    opciones: Array<{ v: Filtros[K][number]; t: string }>,
  ) => {
    if (opciones.length === 0) return null;
    const tildadas = filtros[k] as string[];
    return (
      <fieldset className="min-w-0">
        <legend className="mb-1.5 flex w-full items-center justify-between gap-2 text-xs font-semibold text-[#475569]">
          <span>{titulo}</span>
          {tildadas.length ? (
            <button
              type="button"
              onClick={() => onChange({ ...filtros, [k]: [] })}
              className="text-[11px] font-medium text-[#c27b3d] underline underline-offset-2"
              aria-label={`Quitar el filtro ${titulo}`}
            >
              Quitar
            </button>
          ) : null}
        </legend>
        <div className="flex flex-col gap-1">
          {opciones.map((o) => {
            const v = String(o.v);
            const tildada = tildadas.includes(v);
            const n = cuenta.get(`${k}:${v}`) ?? 0;
            return (
              <label
                key={v}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm ${
                  tildada ? "bg-[#c27b3d]/10 text-[#0f172a]" : "text-[#334155] hover:bg-[#f8fafc]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={tildada}
                  onChange={() => onChange(alternarOpcion(filtros, k, o.v))}
                  className="h-4 w-4 shrink-0 accent-[#c27b3d]"
                />
                <span className="min-w-0 flex-1 truncate">{o.t}</span>
                <span className="shrink-0 text-xs tabular-nums text-[#94a3b8]">{n}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  };

  const siNo = [
    { v: "si" as const, t: "Con" },
    { v: "no" as const, t: "Sin" },
  ];

  return (
    <div className="mb-5 rounded-xl border border-[#eef2f6] bg-white p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={filtros.texto}
          onChange={(e) => onChange({ ...filtros, texto: e.target.value })}
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
      <div
        className={`${abiertos ? "grid" : "hidden"} mt-4 grid-cols-2 gap-x-4 gap-y-4 sm:grid sm:grid-cols-3 lg:grid-cols-6`}
      >
        {grupo("Tipo de producto", "tipoProducto", op.tipos.map((c) => ({ v: c, t: c })))}
        {grupo("Nivel", "categoria", op.categorias.map((c) => ({ v: c, t: c })))}
        {grupo("Evento", "evento", op.eventos.map((c) => ({ v: c, t: c })))}
        {grupo("Estilo", "estilo", op.estilos.map((c) => ({ v: c, t: c })))}
        <div className="flex min-w-0 flex-col gap-4">
          {grupo(
            "Orientación",
            "orientacion",
            op.orientaciones.map((o) => ({ v: o, t: o === "vertical" ? "Vertical" : "Horizontal" })),
          )}
          {grupo(
            "Fotos",
            "cantidadFotos",
            op.cantidades.map((n) => ({ v: String(n), t: n === 0 ? "Sin fotos" : n === 1 ? "1 foto" : `${n} fotos` })),
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {grupo("Listado del curso", "listado", siNo)}
          {grupo("Mosaico de compañeros", "mosaico", siNo)}
          {grupo("Logo del colegio", "logo", siNo)}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#f1f5f9] pt-3 text-sm">
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
