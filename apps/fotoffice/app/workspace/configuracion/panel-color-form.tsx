"use client";

import { useActionState, useState } from "react";
import { guardarColorPanelAction, type PanelColorState } from "./panel-color-actions";

/**
 * Colores del panel: el acento de la marca con el menú lateral negro. Apagado, el panel usa los
 * colores de FOTOFFICE. Independiente de los colores del sitio público.
 */
export function PanelColorForm({ actual, sugerido }: { actual: string | null; sugerido: string }) {
  const [estado, accion, guardando] = useActionState<PanelColorState | undefined, FormData>(guardarColorPanelAction, undefined);
  const [usar, setUsar] = useState(actual !== null);
  const [color, setColor] = useState(actual ?? sugerido);

  return (
    <form action={accion} className="fo-card space-y-4 p-5">
      <div>
        <h2 className="text-base font-semibold">Colores del panel</h2>
        <p className="fo-helper">
          El color de tu marca en botones y selecciones, con el menú lateral negro y tu logo arriba. Sólo cambia cómo
          se ve el panel para tu equipo; el sitio público tiene sus propios colores.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="usar" checked={usar} onChange={(e) => setUsar(e.target.checked)} />
        Usar mis colores en el panel
      </label>

      {usar ? (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded border border-[var(--fo-border)] bg-transparent"
            aria-label="Elegir el color"
          />
          <input
            name="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="fo-input w-32 font-mono"
            aria-label="Código del color"
          />
          <span
            className="rounded-[var(--fo-radius-sm)] px-4 py-2 text-sm font-semibold"
            style={{ background: color, color: "#111111" }}
          >
            Así se ve un botón
          </span>
        </div>
      ) : (
        <input type="hidden" name="color" value={color} />
      )}

      {estado?.error ? <p className="text-sm text-[var(--fo-danger)]">{estado.error}</p> : null}
      {estado?.ok ? <p className="text-sm text-[var(--fo-success)]">Listo. Ya se ven en todo el panel.</p> : null}

      <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar colores"}
      </button>
    </form>
  );
}
