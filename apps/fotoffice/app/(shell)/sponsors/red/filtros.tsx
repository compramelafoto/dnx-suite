"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Form from "next/form";
import { Search } from "lucide-react";

type Opcion = { valor: string; etiqueta: string };

/**
 * Los filtros del directorio, en un formulario GET: la búsqueda la hace el servidor y la
 * dirección queda compartible. El texto se aplica solo al dejar de escribir; las listas, al
 * elegir. Cualquier cambio vuelve a la página 1 (no se manda `pagina`).
 */
export function FiltrosDelDirectorio({
  valores,
  tipos,
  provincias,
  ciudades,
}: {
  valores: { q: string; tipo: string; provincia: string; ciudad: string; ocultar: boolean };
  tipos: Opcion[];
  provincias: Opcion[];
  ciudades: Opcion[];
}) {
  const form = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState(valores.q);
  const primera = useRef(true);

  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    const t = q.trim();
    if (t.length === 1) return;
    const espera = setTimeout(() => form.current?.requestSubmit(), 350);
    return () => clearTimeout(espera);
  }, [q]);

  function alEnviar(e: FormEvent<HTMLFormElement>) {
    // Los campos vacíos no viajan: la dirección queda sólo con lo que filtra de verdad.
    const vacios = Array.from(e.currentTarget.elements).filter(
      (el): el is HTMLInputElement | HTMLSelectElement =>
        (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) &&
        el.name !== "" &&
        el.type !== "checkbox" &&
        el.value === "",
    );
    for (const el of vacios) el.disabled = true;
    window.setTimeout(() => {
      for (const el of vacios) el.disabled = false;
    });
  }

  return (
    <Form
      ref={form}
      action="/sponsors/red"
      scroll={false}
      replace
      onSubmit={alEnviar}
      onChange={(e) => {
        if ((e.target as HTMLElement).dataset.enviar) e.currentTarget.requestSubmit();
      }}
      className="fo-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] lg:items-end"
    >
      <label className="fo-field-stack sm:col-span-2 lg:col-span-1">
        <span className="fo-label">Buscar</span>
        <span className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--fo-muted)]" aria-hidden />
          <input
            type="search"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre, rubro o ciudad"
            className="fo-input w-full"
            // `.fo-input` define su propio padding y le gana a la clase utilitaria.
            style={{ paddingLeft: "2.25rem" }}
            autoComplete="off"
          />
        </span>
      </label>
      <label className="fo-field-stack">
        <span className="fo-label">Tipo</span>
        <select name="tipo" defaultValue={valores.tipo} data-enviar="1" className="fo-input">
          <option value="">Todos</option>
          {tipos.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label className="fo-field-stack">
        <span className="fo-label">Provincia</span>
        <select name="provincia" defaultValue={valores.provincia} data-enviar="1" className="fo-input">
          <option value="">Todas</option>
          {provincias.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label className="fo-field-stack">
        <span className="fo-label">Ciudad</span>
        <select name="ciudad" defaultValue={valores.ciudad} data-enviar="1" className="fo-input">
          <option value="">Todas</option>
          {ciudades.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2 lg:col-span-4">
        <label className="flex items-center gap-2 text-sm text-[var(--fo-text-secondary)]">
          <input type="checkbox" name="ocultar" value="1" defaultChecked={valores.ocultar} data-enviar="1" />
          Ocultar las que ya están en mi lista
        </label>
        <button type="submit" className="fo-btn fo-btn-secondary text-sm">
          Buscar
        </button>
      </div>
    </Form>
  );
}
