"use client";

import type { Ajustes as ValoresAjustes, ClaveAjuste } from "@/lib/impresion/ajustes";

const MIN = -50;
const MAX = 50;

/** Los controles de la spec §7, agrupados como en la pantalla de revelado. */
const GRUPOS: { titulo: string; controles: { clave: ClaveAjuste; etiqueta: string }[] }[] = [
  {
    titulo: "Luz",
    controles: [
      { clave: "exposicion", etiqueta: "Exposición" },
      { clave: "contraste", etiqueta: "Contraste" },
      { clave: "luces", etiqueta: "Luces" },
      { clave: "sombras", etiqueta: "Sombras" },
      { clave: "blancos", etiqueta: "Blancos" },
      { clave: "negros", etiqueta: "Negros" },
    ],
  },
  {
    titulo: "Color",
    controles: [
      { clave: "temperatura", etiqueta: "Temperatura" },
      { clave: "tinte", etiqueta: "Tinte" },
      { clave: "saturacion", etiqueta: "Saturación" },
      { clave: "intensidad", etiqueta: "Intensidad" },
    ],
  },
];

/**
 * Retoque antes de imprimir. Sólo se guarda el valor de cada control (−50 a +50): el servidor
 * aplica la misma fórmula sobre el original completo.
 */
export function Ajustes({
  ajustes,
  onChange,
  onRestablecer,
}: {
  ajustes: ValoresAjustes;
  onChange: (next: ValoresAjustes) => void;
  onRestablecer: () => void;
}) {
  const cambiar = (clave: ClaveAjuste, valor: number) =>
    onChange({ ...ajustes, [clave]: Math.round(Math.min(MAX, Math.max(MIN, valor))) });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
          Ajustes suaves de luz y color. Lo que ves al lado es una vista previa: la plancha se arma desde la foto original, sin
          perder calidad.
        </p>
        <button type="button" className="fo-btn fo-btn-secondary shrink-0" onClick={onRestablecer}>
          Restablecer
        </button>
      </div>
      {GRUPOS.map((g) => (
        <fieldset key={g.titulo} className="space-y-3">
          <legend className="text-sm font-semibold">{g.titulo}</legend>
          <div className="grid gap-4 md:grid-cols-2">
            {g.controles.map((c) => (
              <div key={c.clave} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{c.etiqueta}</span>
                  <span className="text-xs text-[var(--fo-muted)]">{ajustes[c.clave] > 0 ? `+${ajustes[c.clave]}` : ajustes[c.clave]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="fo-icon-btn"
                    onClick={() => cambiar(c.clave, ajustes[c.clave] - 1)}
                    aria-label={`Menos ${c.etiqueta.toLowerCase()}`}
                  >
                    −
                  </button>
                  <input
                    type="range"
                    min={MIN}
                    max={MAX}
                    step={1}
                    value={ajustes[c.clave]}
                    onChange={(e) => cambiar(c.clave, Number(e.target.value))}
                    onDoubleClick={() => cambiar(c.clave, 0)}
                    className="w-full accent-[var(--fo-accent)]"
                    aria-label={c.etiqueta}
                  />
                  <button
                    type="button"
                    className="fo-icon-btn"
                    onClick={() => cambiar(c.clave, ajustes[c.clave] + 1)}
                    aria-label={`Más ${c.etiqueta.toLowerCase()}`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
