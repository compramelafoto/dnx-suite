"use client";

/**
 * Los criterios en un teléfono: de a uno, deslizables, flotando sobre la foto.
 *
 * En una pantalla chica los cuatro criterios en fila dejaban la fotografía
 * reducida a una franja y los botones del 1 al 10 del ancho de un fósforo. Acá
 * se ve **un** criterio por vez, apoyado sobre la obra y no debajo de ella, y
 * se pasa al siguiente arrastrando con el dedo.
 *
 * Al pasar el último criterio no se frena: sigue a la fotografía siguiente con
 * el primer criterio puesto, que es cómo se califica de corrido. El movimiento
 * lo decide `onMover`, que es el mismo camino del Tab en la computadora.
 */
import { useRef, useState } from "react";

import {
  esGestoHorizontal,
  haciaDondePasar,
} from "../../../../lib/fotorank/jury/gestoLateral";

type Criterio = { key: string; nombre: string; min: number; max: number };

type Colores = {
  fondo: string;
  panel: string;
  linea: string;
  tinta: string;
  suave: string;
  chip: string;
};

export function CriteriosEnElTelefono({
  criterios,
  indice,
  notas,
  colores,
  sePuedeTocar,
  onElegirNota,
  onMover,
  onIrACriterio,
}: {
  criterios: Criterio[];
  indice: number;
  notas: Record<string, number>;
  colores: Colores;
  sePuedeTocar: boolean;
  onElegirNota: (valor: number, indice: number) => void;
  onMover: (paso: 1 | -1) => void;
  onIrACriterio: (indice: number) => void;
}) {
  const [arrastre, setArrastre] = useState(0);
  const gesto = useRef<{
    x: number;
    y: number;
    t: number;
    suyo: boolean;
  } | null>(null);

  /*
   * El gesto no sube a la fotografía.
   *
   * Sobre la foto el mismo arrastre cambia de obra. Si dejáramos que el toque
   * burbujee, deslizar sobre los criterios pasaría de criterio **y** de foto a
   * la vez.
   */
  function alEmpezar(e: React.TouchEvent) {
    e.stopPropagation();
    const t = e.touches[0];
    if (!t) return;
    gesto.current = { x: t.clientX, y: t.clientY, t: Date.now(), suyo: false };
  }

  function alMover(e: React.TouchEvent) {
    e.stopPropagation();
    const g = gesto.current;
    const t = e.touches[0];
    if (!g || !t) return;
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (!g.suyo) {
      const horizontal = esGestoHorizontal(dx, dy);
      if (horizontal === null) return;
      if (!horizontal) {
        gesto.current = null;
        return;
      }
      g.suyo = true;
    }
    setArrastre(dx);
  }

  function alSoltar(e: React.TouchEvent) {
    e.stopPropagation();
    const g = gesto.current;
    gesto.current = null;
    if (!g?.suyo) {
      setArrastre(0);
      return;
    }
    const recorrido = arrastre;
    const milisegundos = Date.now() - g.t;
    setArrastre(0);
    const paso = haciaDondePasar({ dx: recorrido, milisegundos });
    if (paso) onMover(paso);
  }

  const arrastrando = arrastre !== 0;
  const corrimiento = `calc(${-indice * 100}% + ${arrastre}px)`;

  return (
    <div
      className="pointer-events-auto select-none overflow-hidden md:hidden"
      style={{
        background: colores.panel,
        borderTop: `1px solid ${colores.linea}`,
        touchAction: "pan-y",
      }}
      onTouchStart={alEmpezar}
      onTouchMove={alMover}
      onTouchEnd={alSoltar}
      onTouchCancel={alSoltar}
    >
      <div
        className="flex"
        style={{
          transform: `translate3d(${corrimiento}, 0, 0)`,
          // Mientras el dedo está apoyado la tarjeta sigue la mano sin retardo;
          // al soltar, se acomoda sola.
          transition: arrastrando
            ? "none"
            : "transform 320ms cubic-bezier(0.22, 0.61, 0.36, 1)",
        }}
      >
        {criterios.map((c, i) => {
          const puesta = notas[c.key];
          return (
            <div key={c.key} className="w-full shrink-0 px-4 pb-3 pt-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold">{c.nombre}</span>
                <span
                  className="font-mono text-lg font-semibold tabular-nums"
                  style={{
                    color:
                      typeof puesta === "number" ? "#e0a061" : colores.suave,
                  }}
                >
                  {typeof puesta === "number" ? puesta : "–"}
                </span>
              </div>
              <div
                className="mt-2 flex gap-1"
                role="radiogroup"
                aria-label={`${c.nombre}, del ${c.min} al ${c.max}`}
              >
                {Array.from(
                  { length: c.max - c.min + 1 },
                  (_, k) => c.min + k,
                ).map((valor) => (
                  <button
                    key={valor}
                    type="button"
                    role="radio"
                    aria-checked={puesta === valor}
                    aria-label={`${valor} en ${c.nombre}`}
                    disabled={!sePuedeTocar}
                    onClick={() => onElegirNota(valor, i)}
                    className="h-11 min-w-0 flex-1 font-mono text-[13px] font-medium transition-colors"
                    style={
                      puesta === valor
                        ? {
                            background: "#e0a061",
                            border: "1px solid #e0a061",
                            color: "#1b1917",
                          }
                        : {
                            background: colores.chip,
                            border: `1px solid ${colores.linea}`,
                            color: colores.suave,
                          }
                    }
                  >
                    {valor}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* En qué criterio está, y cuántos faltan para pasar de foto. */}
      <div
        className="flex items-center justify-center gap-1.5 pb-2"
        aria-hidden="true"
      >
        {criterios.map((c, i) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onIrACriterio(i)}
            aria-label={`Ir a ${c.nombre}`}
            className="h-4 px-0.5"
          >
            <span
              className="block h-1 transition-all duration-300"
              style={{
                width: i === indice ? 18 : 6,
                background:
                  typeof notas[c.key] === "number"
                    ? "#e0a061"
                    : i === indice
                      ? colores.tinta
                      : colores.linea,
                opacity:
                  i === indice || typeof notas[c.key] === "number" ? 1 : 0.6,
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
