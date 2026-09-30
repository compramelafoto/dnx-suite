"use client";

import { ETIQUETA_SALIDA } from "@/lib/circuitos/constantes";

export type Destino = { tipo: "etapa"; id: string; nombre: string } | { tipo: "salida"; salida: string };

/**
 * "Mover a…": la alternativa al arrastre. Siempre está (pantallas chicas, teclado, lectores de
 * pantalla): un `<select>` con las etapas activas y las salidas del circuito.
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
  return (
    <select
      aria-label={`Mover a… (${titulo})`}
      className="fo-input h-8 w-full py-0 text-xs"
      value=""
      disabled={deshabilitado}
      onChange={(ev) => {
        const [tipo, valor] = ev.target.value.split(":", 2) as [string, string | undefined];
        if (!valor) return;
        if (tipo === "etapa") {
          const e = etapas.find((x) => x.id === valor);
          if (e) onElegir({ tipo: "etapa", id: e.id, nombre: e.nombre });
        } else if (tipo === "salida" && salidas.includes(valor)) {
          onElegir({ tipo: "salida", salida: valor });
        }
      }}
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
  );
}
