"use client";

import { useActionState, useState } from "react";
import { reservarTurnoAction, type EstadoAccionTurno } from "@/app/w/[workspaceSlug]/turnos/actions";
import type { DiaConHorarios } from "@/lib/turnos/disponibilidad";
import { SelectorHorario } from "./selector-horario";

const INICIAL: EstadoAccionTurno = { error: null };

export function FormularioReserva({ workspaceSlug, tipoId, dias }: { workspaceSlug: string; tipoId: string; dias: DiaConHorarios[] }) {
  const [estado, accion, pendiente] = useActionState(reservarTurnoAction, INICIAL);
  const [inicio, setInicio] = useState<string | null>(null);

  return (
    <form action={accion} className="space-y-6">
      <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
      <input type="hidden" name="tipoId" value={tipoId} />
      <div className="fo-card p-5">
        <SelectorHorario dias={dias} onElegir={setInicio} />
      </div>

      <div className="fo-card space-y-4 p-5">
        <p className="text-sm font-medium">3. Tus datos</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="fo-field-stack">
            <span className="fo-label">Nombre y apellido</span>
            <input name="nombre" required minLength={2} maxLength={120} autoComplete="name" className="fo-input w-full" />
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Teléfono (WhatsApp)</span>
            <input name="telefono" required inputMode="tel" maxLength={40} autoComplete="tel" className="fo-input w-full" />
          </label>
          <label className="fo-field-stack sm:col-span-2">
            <span className="fo-label">Correo</span>
            <input name="correo" type="email" required maxLength={200} autoComplete="email" className="fo-input w-full" />
          </label>
          <label className="fo-field-stack sm:col-span-2">
            <span className="fo-label">¿Sobre qué querés hablar? (opcional)</span>
            <textarea name="mensaje" rows={3} maxLength={1500} className="fo-input w-full" />
          </label>
          {/* Campo trampa para robots: oculto para las personas. */}
          <label className="hidden" aria-hidden="true">
            Sitio web
            <input name="sitio_web" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        {estado.error ? (
          <p className="fo-alert-error rounded-[var(--fo-radius-sm)] p-3 text-sm text-[var(--fo-danger)]" role="alert">
            {estado.error}
          </p>
        ) : null}
        <button type="submit" className="fo-btn fo-btn-primary" disabled={pendiente || !inicio}>
          {pendiente ? "Reservando…" : inicio ? "Confirmar turno" : "Elegí un horario"}
        </button>
      </div>
    </form>
  );
}
