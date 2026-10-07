"use client";

import { useState } from "react";
import { buscarEnCatalogo, pesos, type ProductoParaEditor } from "@/lib/presupuestos/editor";

/**
 * Buscador del catálogo de los editores de presupuestos (el del presupuesto y el de la propuesta
 * modelo): por nombre o descripción, con los "en lista de precios" primero y, en los combos, el
 * ahorro. Al elegir un producto se limpia la búsqueda.
 */
export function BuscadorCatalogo({
  id,
  catalogo,
  onElegir,
}: {
  id: string;
  catalogo: readonly ProductoParaEditor[];
  onElegir: (p: ProductoParaEditor) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const resultados = busqueda.trim() ? buscarEnCatalogo(catalogo, busqueda) : [];
  return (
    <div className="fo-field-stack relative">
      <label htmlFor={id} className="fo-label">
        Buscar en el catálogo
      </label>
      <input
        id={id}
        className="fo-input"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Producto, servicio o combo"
        autoComplete="off"
      />
      {resultados.length > 0 ? (
        <ul className="mt-1 max-h-72 overflow-auto rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-surface)] text-sm">
          {resultados.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left hover:bg-[var(--fo-surface-hover)]"
                onClick={() => {
                  onElegir(p);
                  setBusqueda("");
                }}
              >
                <span>
                  <span className="font-medium text-[var(--fo-text)]">{p.nombre}</span>
                  {p.esCombo ? (
                    <span className="block text-xs text-[var(--fo-muted)]">
                      Combo
                      {p.ahorro !== null && p.ahorro > 0 && p.sumaComponentes !== null
                        ? ` · ahorrás ${pesos(p.ahorro)} (por separado ${pesos(p.sumaComponentes)})`
                        : ""}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums">{pesos(p.precio)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : busqueda.trim() ? (
        <p className="text-xs text-[var(--fo-muted)]">No hay productos con ese nombre.</p>
      ) : null}
    </div>
  );
}
