"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Form from "next/form";
import { SlidersHorizontal } from "lucide-react";
import { ATAJOS_PERIODO, ETIQUETAS_PERIODO } from "@/lib/listado/periodos";
import type { Opcion } from "@/lib/listado/tipos";
import { FiltroRelacion } from "./filtro-relacion";

/** Un filtro tal como lo dibuja el navegador: sin funciones, con las opciones ya resueltas. */
export type FiltroVisible =
  | { tipo: "lista"; clave: string; etiqueta: string; opciones: Opcion[] }
  | { tipo: "periodo"; clave: string; etiqueta: string }
  | { tipo: "buscador"; clave: string; etiqueta: string; etiquetaInicial: string };

const OTRO = "__otro";

function FiltroPeriodo({ clave, etiqueta, valorInicial }: { clave: string; etiqueta: string; valorInicial: string }) {
  const rango = valorInicial.includes("..") ? valorInicial.split("..") : null;
  const [modo, setModo] = useState(rango ? OTRO : valorInicial);
  const [desde, setDesde] = useState(rango?.[0] ?? "");
  const [hasta, setHasta] = useState(rango?.[1] ?? "");
  const oculto = useRef<HTMLInputElement>(null);
  const valor = modo === OTRO ? (desde && hasta ? `${desde}..${hasta}` : "") : modo;

  /** Aplica apenas queda un período completo (el campo oculto todavía no se volvió a dibujar). */
  function aplicar(nuevo: string) {
    if (!oculto.current) return;
    oculto.current.value = nuevo;
    oculto.current.form?.requestSubmit();
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="flex min-w-40 flex-col gap-1">
        <span className="fo-label">{etiqueta}</span>
        <select className="fo-input" value={modo} onChange={(e) => {
            setModo(e.target.value);
            if (e.target.value !== OTRO) aplicar(e.target.value);
          }}
        >
          <option value="">Cualquier fecha</option>
          {ATAJOS_PERIODO.map((a) => (
            <option key={a} value={a}>
              {ETIQUETAS_PERIODO[a]}
            </option>
          ))}
          <option value={OTRO}>Otro período…</option>
        </select>
      </label>
      {modo === OTRO ? (
        <div className="flex items-center gap-2">
          <input type="date" className="fo-input" aria-label={`${etiqueta}: desde`} value={desde} onChange={(e) => {
              setDesde(e.target.value);
              if (e.target.value && hasta && e.target.value <= hasta) aplicar(`${e.target.value}..${hasta}`);
            }} />
          <span className="text-[var(--fo-muted)]">al</span>
          <input type="date" className="fo-input" aria-label={`${etiqueta}: hasta`} value={hasta} min={desde || undefined} onChange={(e) => {
              setHasta(e.target.value);
              if (desde && e.target.value && desde <= e.target.value) aplicar(`${desde}..${e.target.value}`);
            }} />
        </div>
      ) : null}
      <input ref={oculto} type="hidden" name={clave} value={valor} />
    </div>
  );
}

/**
 * Los filtros de la lista, en un formulario GET: al aplicar, la dirección queda con los filtros
 * elegidos y se conservan búsqueda, orden y filas por página. En pantallas chicas van plegados.
 */
export function BarraDeFiltros({
  lista,
  ruta,
  filtros,
  valores,
  conservar,
}: {
  lista: string;
  ruta: string;
  filtros: FiltroVisible[];
  valores: Record<string, string>;
  /** Parámetros que el formulario no edita pero no debe perder (q, orden, filas). */
  conservar: [string, string][];
}) {
  const plegable = useRef<HTMLDetailsElement>(null);
  const limpio = useRef<HTMLInputElement>(null);
  const activos = filtros.filter((f) => valores[f.clave]).length;

  useEffect(() => {
    // En pantallas anchas los filtros se ven siempre desplegados.
    if (plegable.current && window.matchMedia("(min-width: 1024px)").matches) plegable.current.open = true;
  }, []);

  if (filtros.length === 0) return null;

  function alEnviar(e: FormEvent<HTMLFormElement>) {
    // Los campos vacíos no viajan: la dirección queda sólo con lo que filtra de verdad.
    const campos = Array.from(e.currentTarget.elements).filter(
      (el): el is HTMLInputElement | HTMLSelectElement =>
        (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && el.name !== "" && el.name !== "limpio",
    );
    const vacios = campos.filter((el) => el.value === "");
    for (const el of vacios) el.disabled = true;
    // Sin ningún parámetro, el listado volvería a la última consulta recordada.
    if (limpio.current) limpio.current.disabled = vacios.length !== campos.length;
    window.setTimeout(() => {
      for (const el of vacios) el.disabled = false;
      if (limpio.current) limpio.current.disabled = true;
    });
  }

  return (
    <details
      ref={plegable}
      className="group rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] lg:border-0 lg:bg-transparent"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-[var(--fo-text)] lg:hidden">
        <SlidersHorizontal className="size-4" aria-hidden />
        Filtros ({activos})
      </summary>
      <Form
        action={ruta}
        scroll={false}
        onSubmit={alEnviar}
        onChange={(e) => {
          if ((e.target as HTMLElement).dataset.enviar) e.currentTarget.requestSubmit();
        }}
        className="flex flex-col gap-3 px-4 pb-4 lg:flex-row lg:flex-wrap lg:items-end lg:px-0 lg:pb-0"
      >
        {conservar.map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input ref={limpio} type="hidden" name="limpio" value="1" disabled />
        {filtros.map((f) => {
          if (f.tipo === "periodo") return <FiltroPeriodo key={f.clave} clave={f.clave} etiqueta={f.etiqueta} valorInicial={valores[f.clave] ?? ""} />;
          if (f.tipo === "buscador") {
            return (
              <FiltroRelacion
                key={f.clave}
                lista={lista}
                clave={f.clave}
                etiqueta={f.etiqueta}
                valorInicial={valores[f.clave] ?? ""}
                etiquetaInicial={f.etiquetaInicial}
              />
            );
          }
          return (
            <label key={f.clave} className="flex min-w-40 flex-col gap-1 text-sm">
              <span className="fo-label">{f.etiqueta}</span>
              <select name={f.clave} className="fo-input" defaultValue={valores[f.clave] ?? ""} data-enviar="1">
                <option value="">Todos</option>
                {f.opciones.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        <button type="submit" className="fo-btn fo-btn-secondary">
          Aplicar
        </button>
      </Form>
    </details>
  );
}
