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
      className="flex gap-1"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (!destino) return;
        setElegido("");
        onElegir(destino);
      }}
    >
      <select
        aria-label={`Mover a… (${titulo})`}
        className="fo-input h-8 min-w-0 flex-1 py-0 text-xs"
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
      <button type="submit" className="fo-btn fo-btn-secondary h-8 px-2 text-xs" disabled={deshabilitado || !destino} aria-label={`Mover ${titulo}`}>
        Mover
      </button>
    </form>
  );
}
