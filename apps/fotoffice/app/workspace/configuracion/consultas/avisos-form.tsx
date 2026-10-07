"use client";

import Link from "next/link";
import { useActionState } from "react";
import { guardarAvisosAction, type EstadoConsultasConfig } from "./actions";

export type AjustesAvisos = { responsableUserId: number | null; notificarCorreo: boolean; crearTarea: boolean };

const INICIAL: EstadoConsultasConfig = { error: null };

/**
 * Pestaña Avisos: quién se entera de cada consulta nueva y cómo. El texto del correo es la
 * plantilla del sistema "Aviso de consulta nueva", que se edita en Plantillas → Automáticos.
 */
export function AvisosForm({ ajustes, responsables }: { ajustes: AjustesAvisos; responsables: { id: number; nombre: string }[] }) {
  const [estado, guardar, guardando] = useActionState(guardarAvisosAction, INICIAL);
  // Un responsable guardado que ya no tiene "Gestionar" igual se muestra, para no perderlo sin
  // aviso; si se guarda así, el servidor lo rechaza y pide elegir otro.
  const actualFuera = ajustes.responsableUserId !== null && !responsables.some((r) => r.id === ajustes.responsableUserId);
  return (
    <section className="fo-card space-y-4 p-5" aria-labelledby="avisos-titulo">
      <div className="space-y-1">
        <h2 id="avisos-titulo" className="text-base font-semibold">
          Avisos de consultas nuevas
        </h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Cuando llega una consulta (del formulario web o cargada por el equipo), avisamos a una persona por correo y le
          dejamos la tarea «Responder consulta». Las consultas importadas desde un CSV no avisan.
        </p>
      </div>
      <form action={guardar} className="space-y-4">
        <div className="fo-field-stack max-w-md">
          <label className="fo-label" htmlFor="avisos-responsable">
            Responsable de las consultas nuevas
          </label>
          <select
            id="avisos-responsable"
            name="responsable"
            defaultValue={ajustes.responsableUserId === null ? "" : String(ajustes.responsableUserId)}
            className="fo-input"
          >
            <option value="">Nadie en particular (avisa al dueño)</option>
            {actualFuera ? (
              <option value={String(ajustes.responsableUserId)}>La persona elegida ya no puede gestionar Consultas: elegí otra</option>
            ) : null}
            {responsables.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.nombre}
              </option>
            ))}
          </select>
          <p className="text-xs text-[var(--fo-muted)]">Sólo aparecen las personas del equipo con «Gestionar» en Consultas.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="correo" value="1" defaultChecked={ajustes.notificarCorreo} />
          Mandar un correo
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="tarea" value="1" defaultChecked={ajustes.crearTarea} />
          Crear la tarea «Responder consulta»
        </label>
        <p className="text-sm text-[var(--fo-muted)]">
          El texto del correo se edita en{" "}
          <Link href="/workspace/configuracion/plantillas?canal=automaticos" className="text-[var(--fo-accent)] hover:underline">
            Plantillas → Automáticos
          </Link>
          .
        </p>
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={guardando}>
          Guardar
        </button>
        {estado?.error ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            {estado.error}
          </p>
        ) : estado?.ok ? (
          <p role="status" className="text-sm text-[var(--fo-success)]">
            {estado.ok}
          </p>
        ) : null}
      </form>
    </section>
  );
}
