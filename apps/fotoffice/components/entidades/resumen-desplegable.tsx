"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { ICONO_ENTIDAD } from "@/components/entidades/entidad";
import { ENTIDAD, estiloDeEntidad } from "@/lib/entidades/colores";
import type { CuadroDeResumen, PanelDeResumen } from "@/lib/clients/resumen";

/**
 * Los cuadros de colores de una ficha, como botones: al tocar uno se despliega debajo su
 * información (la tarjeta de consultas, cotizaciones, pedidos…); al tocarlo de nuevo, se cierra.
 * Así la ficha queda limpia y el detalle aparece sólo cuando se pide.
 *
 * Los paneles llegan ya armados desde el servidor (`paneles`); acá sólo se elige cuál se ve.
 * Un enlace con `#pedidos` (o cualquier panel) lo abre al entrar.
 */
export function ResumenDesplegable({ cuadros, paneles }: { cuadros: CuadroDeResumen[]; paneles: Partial<Record<PanelDeResumen, ReactNode>> }) {
  const [abierto, setAbierto] = useState<{ panel: PanelDeResumen; desde: string } | null>(null);
  const id = useId();

  useEffect(() => {
    const ancla = window.location.hash.slice(1) as PanelDeResumen;
    const cuadro = cuadros.find((c) => c.panel === ancla);
    if (cuadro && paneles[ancla]) setAbierto({ panel: ancla, desde: cuadro.entidad });
    // Sólo al entrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const panel = abierto ? paneles[abierto.panel] : null;

  return (
    <section aria-label="Resumen" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 2xl:grid-cols-7">
        {cuadros.map((c) => {
          const Icono = ICONO_ENTIDAD[c.entidad];
          const activo = abierto?.desde === c.entidad;
          const tienePanel = Boolean(paneles[c.panel]);
          return (
            <button
              key={c.entidad}
              type="button"
              style={estiloDeEntidad(c.entidad)}
              aria-expanded={tienePanel ? activo : undefined}
              aria-controls={tienePanel ? `${id}-panel` : undefined}
              disabled={!tienePanel}
              onClick={() => setAbierto(activo ? null : { panel: c.panel, desde: c.entidad })}
              className={[
                "group flex min-h-[5.5rem] flex-col justify-between gap-2 rounded-[var(--fo-radius)] p-3.5 text-left transition",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ent)] disabled:cursor-default",
                // Todos con el color lleno de su elemento, también los que están en cero.
                "bg-[var(--ent)] text-white shadow-[var(--fo-shadow-sm)] hover:brightness-110",
                activo ? "ring-2 ring-[var(--ent)] ring-offset-2 ring-offset-[var(--fo-bg)]" : "",
              ].join(" ")}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/20"
                  >
                    <Icono className="size-4" />
                  </span>
                  <span className="truncate">{ENTIDAD[c.entidad].plural}</span>
                </span>
                {tienePanel ? (
                  <ChevronDown aria-hidden className={`size-4 shrink-0 opacity-70 transition-transform motion-reduce:transition-none ${activo ? "rotate-180" : ""}`} />
                ) : null}
              </span>
              <span className="block">
                <span className="block text-2xl font-bold leading-tight tabular-nums">{c.valor}</span>
                {c.detalle ? <span className="block text-xs font-medium text-white/85">{c.detalle}</span> : null}
              </span>
            </button>
          );
        })}
      </div>

      {panel ? (
        <div id={`${id}-panel`} className="max-w-4xl motion-safe:animate-[fo-desplegar_160ms_ease-out]">
          {panel}
        </div>
      ) : (
        <p className="text-xs text-[var(--fo-muted)]">Tocá un cuadro para ver el detalle.</p>
      )}
    </section>
  );
}
