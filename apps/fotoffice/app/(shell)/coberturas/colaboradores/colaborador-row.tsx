"use client";

import { useActionState, useState } from "react";
import {
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
  MAX_TRAVEL_KM_MAX,
  MAX_TRAVEL_KM_MIN,
  TRANSPORT_LABELS,
  TRANSPORT_OPTIONS,
} from "@/lib/coverages/colaboradores";
import { saveCollaboratorProfileAction, type CollaboratorProfileState } from "./actions";
import { TANDA_FORM_ID } from "./tanda-form";

const inicial: CollaboratorProfileState = { error: null, ok: null };

type Perfil = {
  active: boolean;
  homeCity: string | null;
  coverageZones: string[];
  maxTravelKm: number | null;
  transport: string | null;
  equipment: string[];
  specialties: string[];
  experienceLevel: string | null;
  acceptsUrgent: boolean;
  notes: string | null;
} | null;

/**
 * Una fila del padrón, con su perfil de colaborador.
 *
 * Es un componente cliente porque cada fila abre y cierra su propio formulario de edición sin
 * recargar la tabla entera, y porque `useActionState` necesita mostrar el resultado del guardado
 * (o su error) sólo en la fila que se tocó. La verificación real de permisos vive en el
 * servidor, dentro de `saveCollaboratorProfileAction`: acá sólo se decide qué mostrar.
 */
export function ColaboradorRow({
  memberId,
  nombre,
  memberNumber,
  memberStatusLabel,
  perfil,
}: {
  memberId: string;
  nombre: string;
  memberNumber: string;
  memberStatusLabel: string;
  perfil: Perfil;
}) {
  const [abierto, setAbierto] = useState(false);
  const [state, action, guardando] = useActionState(saveCollaboratorProfileAction, inicial);

  const zonas = perfil?.coverageZones ?? [];

  return (
    <>
      <tr className="hover:bg-[var(--fo-surface-hover)]/60">
        <td className="px-4 py-3">
          {/*
            La casilla se asocia al formulario de la barra con `form=`, y no por estar adentro de
            él: un `<form>` que envolviera la tabla dejaría el formulario de edición de esta misma
            fila anidado adentro de otro, y el navegador lo descarta. Ver `TANDA_FORM_ID`.

            Nadie queda sin casilla, ni siquiera quien está de baja en el padrón: a esa persona no
            se la puede habilitar, pero sí quitar, que es justo lo que a veces hay que hacer. Por
            qué no se la habilitó lo dice el resumen de la tanda.
          */}
          <input
            type="checkbox"
            name="memberIds"
            value={memberId}
            form={TANDA_FORM_ID}
            aria-label={`Seleccionar a ${nombre}`}
            className="size-5 accent-[var(--fo-accent)]"
          />
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-[var(--fo-text)]">{nombre}</p>
          <p className="text-xs text-[var(--fo-muted)] font-mono">{memberNumber}</p>
        </td>
        <td className="px-4 py-3 text-[var(--fo-muted)]">{memberStatusLabel}</td>
        <td className="px-4 py-3">
          <span
            className={
              perfil?.active
                ? "text-[var(--fo-success)] font-medium"
                : "text-[var(--fo-muted)]"
            }
          >
            {perfil?.active ? "Sí" : "No"}
          </span>
        </td>
        <td className="px-4 py-3 text-[var(--fo-muted)]">{perfil?.homeCity ?? "—"}</td>
        <td className="px-4 py-3 text-[var(--fo-muted)]">
          {zonas.length > 0 ? zonas.join(", ") : "—"}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            className="text-[var(--fo-accent)] font-medium hover:underline"
          >
            {abierto ? "Cerrar" : "Editar"}
          </button>
        </td>
      </tr>

      {abierto ? (
        <tr>
          <td colSpan={7} className="px-4 py-4 bg-[var(--fo-bg-elevated)]">
            <form action={action} className="space-y-4">
              <input type="hidden" name="memberId" value={memberId} />

              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={perfil?.active ?? false}
                  className="size-5 accent-[var(--fo-accent)]"
                />
                Colaborador activo: ve convocatorias y se puede postular
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="fo-field-stack">
                  <span className="fo-label">Ciudad</span>
                  <input
                    name="homeCity"
                    defaultValue={perfil?.homeCity ?? ""}
                    className="fo-input"
                  />
                </label>
                <label className="fo-field-stack">
                  <span className="fo-label">Radio de traslado (km)</span>
                  <input
                    type="number"
                    name="maxTravelKm"
                    min={MAX_TRAVEL_KM_MIN}
                    max={MAX_TRAVEL_KM_MAX}
                    defaultValue={perfil?.maxTravelKm ?? ""}
                    className="fo-input"
                  />
                </label>
              </div>

              <label className="fo-field-stack">
                <span className="fo-label">Zonas donde cubre (una por línea)</span>
                <textarea
                  name="coverageZones"
                  rows={2}
                  defaultValue={zonas.join("\n")}
                  className="fo-input"
                />
              </label>

              {/*
                A propósito, este bloque no dice "todavía no se usa para nada": es un detalle
                de esta etapa, no algo que a quien coordina le sirva saber mientras completa el
                perfil de alguien.
              */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="fo-field-stack">
                  <span className="fo-label">Transporte</span>
                  <select
                    name="transport"
                    defaultValue={perfil?.transport ?? ""}
                    className="fo-input"
                  >
                    <option value="">Sin especificar</option>
                    {TRANSPORT_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {TRANSPORT_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="fo-field-stack">
                  <span className="fo-label">Nivel de experiencia</span>
                  <select
                    name="experienceLevel"
                    defaultValue={perfil?.experienceLevel ?? ""}
                    className="fo-input"
                  >
                    <option value="">Sin especificar</option>
                    {EXPERIENCE_LEVELS.map((n) => (
                      <option key={n} value={n}>
                        {EXPERIENCE_LEVEL_LABELS[n]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="fo-field-stack">
                <span className="fo-label">Equipo propio (uno por línea)</span>
                <textarea
                  name="equipment"
                  rows={2}
                  defaultValue={(perfil?.equipment ?? []).join("\n")}
                  className="fo-input"
                />
              </label>

              <label className="fo-field-stack">
                <span className="fo-label">Especialidades (una por línea)</span>
                <textarea
                  name="specialties"
                  rows={2}
                  defaultValue={(perfil?.specialties ?? []).join("\n")}
                  className="fo-input"
                />
              </label>

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="acceptsUrgent"
                  defaultChecked={perfil?.acceptsUrgent ?? false}
                  className="size-5 accent-[var(--fo-accent)]"
                />
                Acepta coberturas urgentes
              </label>

              <label className="fo-field-stack">
                <span className="fo-label">Notas internas</span>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={perfil?.notes ?? ""}
                  className="fo-input"
                />
              </label>

              {state.error ? (
                <p role="alert" className="text-sm text-[var(--fo-danger)]">
                  {state.error}
                </p>
              ) : null}
              {state.ok ? <p className="text-sm text-[var(--fo-muted)]">{state.ok}</p> : null}

              <button type="submit" className="fo-btn min-h-11" disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar"}
              </button>
            </form>
          </td>
        </tr>
      ) : null}
    </>
  );
}
