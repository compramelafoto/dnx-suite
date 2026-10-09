"use client";

import { useState, useTransition } from "react";
import { guardarRecordatorioAgendaAction } from "@/app/actions/agenda";

/**
 * «Recordatorio al cliente»: encendido (apagado por omisión) y horas de anticipación. Lo manda una
 * tarea horaria (`lib/agenda/recordatorios.ts`) a los contactos con correo que participan de una cita.
 */
export function RecordatorioForm({ activo, horas }: { activo: boolean; horas: number }) {
  const [pendiente, iniciar] = useTransition();
  const [encendido, setEncendido] = useState(activo);
  const [valor, setValor] = useState(String(horas));
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    iniciar(async () => {
      try {
        const r = await guardarRecordatorioAgendaAction({ activo: encendido, horas: valor });
        if (!r.ok) return setError(r.error);
        setOk("Guardado.");
      } catch {
        setError("No pudimos guardar los cambios. Probá de nuevo en un rato.");
      }
    });
  }

  return (
    <form onSubmit={guardar} className="fo-card space-y-4 p-5" aria-labelledby="recordatorio-agenda-titulo">
      <div className="space-y-1">
        <h2 id="recordatorio-agenda-titulo" className="text-base font-semibold">
          Recordatorio al cliente
        </h2>
        <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
          Unas horas antes de una cita, se le manda un correo a cada contacto con correo que participa de ella (nunca al equipo). Sale una vez
          por cita y horario: si movés la cita, vuelve a avisar. No sale si la cita está anulada o ya se hizo, y cuenta en el tope de correos
          automáticos. El texto se edita en Configuración → Plantillas → Automáticos.
        </p>
      </div>
      <div className="fo-field-stack max-w-xs">
        <label className="fo-label" htmlFor="agenda-recordatorio-horas">
          Horas antes de la cita
        </label>
        <input
          id="agenda-recordatorio-horas"
          type="number"
          inputMode="numeric"
          min={1}
          max={168}
          step={1}
          required
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="fo-input"
          aria-describedby="agenda-recordatorio-horas-ayuda"
        />
        <p id="agenda-recordatorio-horas-ayuda" className="text-xs text-[var(--fo-muted)]">
          De 1 a 168 (una semana). El aviso sale en la hora en punto siguiente a que la cita entre en ese plazo.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={encendido} onChange={(e) => setEncendido(e.target.checked)} />
        Activar el recordatorio de citas
      </label>
      <div className="space-y-2">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        <div aria-live="polite">
          {error ? (
            <p role="alert" className="text-sm text-[var(--fo-danger)]">
              {error}
            </p>
          ) : ok ? (
            <p role="status" className="text-sm text-[var(--fo-success)]">
              {ok}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
