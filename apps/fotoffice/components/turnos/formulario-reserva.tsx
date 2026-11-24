"use client";

import { useActionState, useEffect, useState } from "react";
import { reservarTurnoAction, type EstadoAccionTurno } from "@/app/w/[workspaceSlug]/turnos/actions";
import type { DiaConHorarios } from "@/lib/turnos/disponibilidad";
import { avisarReservaAMeta } from "@/lib/turnos/meta-pixel";
import { SelectorHorario } from "./selector-horario";

const INICIAL: EstadoAccionTurno = { error: null };

/** Lo que se espera para que el evento salga antes de dejar la página. */
const ESPERA_EVENTO_MS = 600;

export function FormularioReserva({ workspaceSlug, tipoId, tipoNombre, dias }: { workspaceSlug: string; tipoId: string; tipoNombre: string; dias: DiaConHorarios[] }) {
  const [estado, accion, pendiente] = useActionState(reservarTurnoAction, INICIAL);
  const [inicio, setInicio] = useState<string | null>(null);
  const reservado = Boolean(estado.destino);

  useEffect(() => {
    const destino = estado.destino;
    if (!destino) return;
    avisarReservaAMeta(tipoNombre);
    // Carga completa (no navegación del lado del cliente): la página de gestión lleva el token en la
    // dirección y así abre sin el píxel cargado.
    const t = window.setTimeout(() => window.location.assign(destino), ESPERA_EVENTO_MS);
    return () => window.clearTimeout(t);
  }, [estado.destino, tipoNombre]);

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
        <button type="submit" className="fo-btn fo-btn-primary" disabled={pendiente || reservado || !inicio}>
          {pendiente || reservado ? "Reservando…" : inicio ? "Confirmar turno" : "Elegí un horario"}
        </button>
      </div>
    </form>
  );
}
