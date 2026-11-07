"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { guardarAjustesTurnosAction } from "@/app/actions/turnos";
import type { AjustesTurnos } from "@/lib/turnos/constantes";

type Pantalla = { [K in keyof AjustesTurnos]: string };

function aPantalla(a: AjustesTurnos): Pantalla {
  return {
    pageTitle: a.pageTitle ?? "", pageIntro: a.pageIntro ?? "", notifyEmail: a.notifyEmail ?? "",
    cancelWindowHours: String(a.cancelWindowHours), bufferMinutes: String(a.bufferMinutes), minAdvanceHours: String(a.minAdvanceHours), maxAdvanceDays: String(a.maxAdvanceDays),
  };
}

export function AjustesTurnosForm({ inicial }: { inicial: AjustesTurnos }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [a, setA] = useState(aPantalla(inicial));
  const campo = (k: keyof Pantalla) => ({
    value: a[k],
    onChange: (e: { target: { value: string } }) => {
      setGuardado(false);
      setA((x) => ({ ...x, [k]: e.target.value }));
    },
  });

  return (
    <form
      className="fo-card space-y-4 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        iniciar(async () => {
          try {
            const r = await guardarAjustesTurnosAction({
              ...a,
              cancelWindowHours: Number(a.cancelWindowHours), bufferMinutes: Number(a.bufferMinutes), minAdvanceHours: Number(a.minAdvanceHours), maxAdvanceDays: Number(a.maxAdvanceDays),
            });
            if (!r.ok) return setError(r.error);
            setGuardado(true);
            router.refresh();
          } catch {
            setError("No se pudo guardar. Probá de nuevo.");
          }
        });
      }}
    >
      <label className="fo-field-stack">
        <span className="fo-label">Título de la página</span>
        <input className="fo-input w-full" maxLength={120} placeholder="Agendá un turno" {...campo("pageTitle")} />
      </label>
      <label className="fo-field-stack">
        <span className="fo-label">Texto de presentación</span>
        <textarea className="fo-input w-full" rows={3} maxLength={2000} {...campo("pageIntro")} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="fo-field-stack">
          <span className="fo-label">Anticipación mínima (horas)</span>
          <input type="number" min={0} max={720} className="fo-input w-full" {...campo("minAdvanceHours")} />
        </label>
        <label className="fo-field-stack">
          <span className="fo-label">Hasta cuántos días adelante</span>
          <input type="number" min={1} max={365} className="fo-input w-full" {...campo("maxAdvanceDays")} />
        </label>
        <label className="fo-field-stack">
          <span className="fo-label">Plazo para cancelar o cambiar (horas antes)</span>
          <input type="number" min={0} max={720} className="fo-input w-full" {...campo("cancelWindowHours")} />
        </label>
        <label className="fo-field-stack">
          <span className="fo-label">Margen entre turnos (minutos)</span>
          <input type="number" min={0} max={240} className="fo-input w-full" {...campo("bufferMinutes")} />
        </label>
      </div>
      <label className="fo-field-stack">
        <span className="fo-label">Correo que recibe los avisos (si lo dejás vacío, el del dueño)</span>
        <input type="email" className="fo-input w-full" maxLength={200} {...campo("notifyEmail")} />
      </label>
      {error ? (
        <p className="fo-alert-error rounded-[var(--fo-radius-sm)] p-3 text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <button type="submit" className="fo-btn fo-btn-primary" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        {guardado ? <span className="text-sm text-[var(--fo-muted)]">Guardado.</span> : null}
      </div>
    </form>
  );
}
