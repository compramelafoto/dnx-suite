"use client";

import { useState } from "react";
import { ETIQUETA_SALIDA } from "@/lib/circuitos/constantes";

export type Destino = { tipo: "etapa"; id: string; nombre: string } | { tipo: "salida"; salida: string };

/**
 * "Mover a…": la alternativa al arrastre. Siempre está (pantallas chicas, teclado, lectores de
 * pantalla). Es de dos pasos: elegir en el `<select>` no hace nada (recorrerlo con las flechas no
 * debe mover la consulta); recién el botón "Mover" aplica lo elegido.
 */
export function MoverA({
  titulo,
  etapas,
  salidas,
  deshabilitado,
  onElegir,
}: {
  titulo: string;
  etapas: { id: string; nombre: string }[];
  salidas: string[];
  deshabilitado: boolean;
  onElegir: (destino: Destino) => void;
}) {
  const [elegido, setElegido] = useState("");

  function destinoElegido(): Destino | null {
    const [tipo, valor] = elegido.split(":", 2) as [string, string | undefined];
    if (!valor) return null;
    if (tipo === "etapa") {
      const e = etapas.find((x) => x.id === valor);
      return e ? { tipo: "etapa", id: e.id, nombre: e.nombre } : null;
    }
    return tipo === "salida" && salidas.includes(valor) ? { tipo: "salida", salida: valor } : null;
  }
  const destino = destinoElegido();

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!destino) return;
        setElegido("");
        onElegir(destino);
      }}
    >
      <select
        aria-label={`Mover a… (${titulo})`}
        className="h-7 min-w-0 flex-1 cursor-pointer rounded-md border border-transparent bg-transparent px-1.5 text-xs text-[var(--fo-muted)] outline-none transition-colors hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)] focus-visible:border-[var(--fo-accent)] focus-visible:text-[var(--fo-text)] disabled:cursor-not-allowed disabled:opacity-50"
        value={elegido}
        disabled={deshabilitado}
        onChange={(ev) => setElegido(ev.target.value)}
      >
        <option value="">Mover a…</option>
        {etapas.length > 0 ? (
          <optgroup label="Etapas">
            {etapas.map((e) => (
              <option key={e.id} value={`etapa:${e.id}`}>
                {e.nombre}
              </option>
            ))}
          </optgroup>
        ) : null}
        <optgroup label="Cerrar">
          {salidas.map((s) => (
            <option key={s} value={`salida:${s}`}>
              {ETIQUETA_SALIDA[s] ?? s}
            </option>
          ))}
        </optgroup>
      </select>
      {/* El botón aparece al elegir un destino: elegir en la lista sola no mueve nada. */}
      {destino ? (
        <button type="submit" className="fo-btn fo-btn-primary h-7 min-h-0! px-3! text-xs!" disabled={deshabilitado || !destino} aria-label={`Mover ${titulo}`}>
          Mover
        </button>
      ) : null}
    </form>
  );
}
