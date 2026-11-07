"use client";

import { useState } from "react";
import type { DiaConHorarios } from "@/lib/turnos/disponibilidad";

/**
 * Elegir día y hora: primero los días con lugar, después sus horarios. El horario elegido viaja en el
 * campo oculto `inicio` (instante ISO). Todo en hora de Argentina (ya viene formateado del servidor).
 */
export function SelectorHorario({ dias, onElegir }: { dias: DiaConHorarios[]; onElegir?: (inicio: string | null) => void }) {
  const [dia, setDia] = useState<string>(dias[0]?.ymd ?? "");
  const [inicio, setInicio] = useState<string | null>(null);
  const actual = dias.find((d) => d.ymd === dia) ?? dias[0];

  function elegir(v: string | null) {
    setInicio(v);
    onElegir?.(v);
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name="inicio" value={inicio ?? ""} />
      <div>
        <p className="mb-2 text-sm font-medium">1. Elegí el día</p>
        <div className="flex flex-wrap gap-2" role="listbox" aria-label="Días con horarios libres">
          {dias.map((d) => (
            <button
              key={d.ymd}
              type="button"
              role="option"
              aria-selected={d.ymd === actual?.ymd}
              onClick={() => {
                setDia(d.ymd);
                elegir(null);
              }}
              className={`rounded-[var(--fo-radius-sm)] border px-3 py-2 text-left text-sm transition first-letter:uppercase ${
                d.ymd === actual?.ymd ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-white" : "border-[var(--fo-border)] hover:border-[var(--fo-accent)]"
              }`}
            >
              {d.etiqueta}
            </button>
          ))}
        </div>
      </div>
      {actual ? (
        <div>
          <p className="mb-2 text-sm font-medium">2. Elegí el horario</p>
          <div className="flex flex-wrap gap-2" role="listbox" aria-label={`Horarios del ${actual.etiqueta}`}>
            {actual.horarios.map((h) => (
              <button
                key={h.inicio}
                type="button"
                role="option"
                aria-selected={inicio === h.inicio}
                onClick={() => elegir(h.inicio)}
                className={`min-w-[4.5rem] rounded-[var(--fo-radius-sm)] border px-3 py-2 text-sm tabular-nums transition ${
                  inicio === h.inicio ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-white" : "border-[var(--fo-border)] hover:border-[var(--fo-accent)]"
                }`}
              >
                {h.hora}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
