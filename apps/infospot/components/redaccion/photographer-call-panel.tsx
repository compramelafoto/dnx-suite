"use client";

import { useState } from "react";
import {
  savePhotographerCallAndRedirect,
  provisionPhotographerCallAndRedirect,
  closePhotographerCallAndRedirect,
} from "@/app/actions/photographer-call";
import { CLF_EVENT_TYPES } from "@/lib/clf-event-provisioning/category-type-map";
import { resolvePhotographerCallDisplay } from "@/lib/clf-event-provisioning/call-display-status";
import { NearbyNotifyPanel } from "@/components/redaccion/nearby-notify-panel";

const fieldClass = "is-input mt-2";

export type PhotographerCallShape = {
  enabled: boolean;
  visibility: string;
  joinPolicy: string;
  maxPhotographers: number | null;
  photographerTerms: string | null;
  operationalDescription: string | null;
  clfEventType: string;
  desiredClfStatus: string;
  organizerEmail: string | null;
  ownershipStatus: string;
  provisioningStatus: string;
  provisioningError: string | null;
  provisioningBlockedReason: string | null;
  publicUrl: string | null;
  clfEventId: number | null;
};

type Props = {
  eventId: string;
  call: PhotographerCallShape | null;
  defaultOrganizerEmail: string;
  defaultClfEventType: string;
  missingGeoref: boolean;
  canProvision: boolean;
  /** Permiso independiente de envío de avisos geográficos. */
  canNotify: boolean;
  /** Si el evento InfoSpot ya terminó (endAt/startAt pasado). */
  eventEnded?: boolean;
};

const TONE_CLASS: Record<string, string> = {
  neutral: "border-[var(--is-border)] bg-[var(--is-bg-secondary)] text-[var(--is-text-secondary)]",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  danger: "border-red-200 bg-red-50 text-red-900",
  info: "border-sky-200 bg-sky-50 text-sky-950",
};

export function PhotographerCallPanel({
  eventId,
  call,
  defaultOrganizerEmail,
  defaultClfEventType,
  missingGeoref,
  canProvision,
  canNotify,
  eventEnded = false,
}: Props) {
  const [enabled, setEnabled] = useState(call?.enabled ?? false);
  const status = call?.provisioningStatus ?? "NOT_REQUESTED";
  const display = resolvePhotographerCallDisplay({
    enabled,
    provisioningStatus: status,
    desiredClfStatus: call?.desiredClfStatus,
    clfEventId: call?.clfEventId,
    publicUrl: call?.publicUrl,
    missingGeoref,
    eventEnded,
  });

  const saveAction = savePhotographerCallAndRedirect.bind(null, eventId);
  const provisionAction = provisionPhotographerCallAndRedirect.bind(null, eventId);
  const closeAction = closePhotographerCallAndRedirect.bind(null, eventId);

  return (
    <section className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Convocatoria de fotógrafos</h2>
        <p className="mt-1 text-sm text-[var(--is-muted)]">
          Crear o publicar la actividad en InfoSpot no abre una convocatoria en CLF. Hace falta
          una acción explícita. La inscripción ocurre solo en ComprameLaFoto.
        </p>
      </div>

      <div
        className={`rounded-[var(--is-radius-sm)] border px-3 py-3 text-sm ${TONE_CLASS[display.tone]}`}
        role="status"
        data-call-status={display.status}
      >
        <p className="font-semibold">{display.label}</p>
        <p className="mt-1 leading-relaxed">{display.description}</p>
        {call?.clfEventId ? (
          <p className="mt-2 text-xs opacity-90">Evento CLF #{call.clfEventId}</p>
        ) : null}
      </div>

      {!canProvision ? (
        <p className="rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg-secondary)] px-3 py-3 text-sm text-[var(--is-muted)]">
          No tenés permiso para crear convocatorias en ComprameLaFoto.
        </p>
      ) : null}

      {canProvision && missingGeoref ? (
        <p className="rounded-[var(--is-radius-sm)] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Falta georreferenciar el evento antes de abrir la convocatoria públicamente.
        </p>
      ) : null}

      {call?.provisioningBlockedReason && status === "BLOCKED" ? (
        <p className="rounded-[var(--is-radius-sm)] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {call.provisioningBlockedReason}
        </p>
      ) : null}

      {call?.provisioningError && status === "FAILED" ? (
        <p className="rounded-[var(--is-radius-sm)] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {call.provisioningError}
        </p>
      ) : null}

      {call?.publicUrl || call?.clfEventId ? (
        <div className="flex flex-wrap gap-3 text-sm">
          {call.publicUrl ? (
            <a
              href={call.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center font-medium text-[var(--is-accent)] hover:underline"
            >
              Abrir en CLF (página pública)
            </a>
          ) : null}
          {call.clfEventId && !call.publicUrl ? (
            <span className="text-[var(--is-muted)]">Vinculado a CLF #{call.clfEventId}</span>
          ) : null}
        </div>
      ) : null}

      {!canProvision ? null : (
      <form action={saveAction} className="space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="photographerCallEnabled"
            value="true"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-1 size-4"
          />
          <span>
            <span className="font-semibold">Convocar fotógrafos mediante ComprameLaFoto</span>
            <span className="block text-[var(--is-muted)]">
              Por defecto no. Guardar la actividad en InfoSpot no crea nada en CLF. La acción
              «Crear o actualizar convocatoria en CLF» es explícita y separada.
            </span>
          </span>
        </label>

        {enabled ? (
          <div className="space-y-4 border-t border-[var(--is-border)] pt-4">
            <label className="block">
              <span className="text-sm font-medium">Modalidad de ingreso</span>
              <select
                name="joinPolicy"
                defaultValue={call?.joinPolicy ?? "OPEN"}
                className={fieldClass}
              >
                <option value="OPEN">Ingreso abierto</option>
                <option value="REQUEST">Con aprobación</option>
                <option value="INVITE_ONLY">Solo invitación</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Visibilidad</span>
              <select
                name="visibility"
                defaultValue={call?.visibility ?? "PUBLIC"}
                className={fieldClass}
              >
                <option value="PUBLIC">Pública</option>
                <option value="UNLISTED">No listada</option>
                <option value="PRIVATE">Privada</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Cupo máximo (vacío = ilimitado)</span>
              <input
                name="maxPhotographers"
                type="number"
                min={1}
                defaultValue={call?.maxPhotographers ?? ""}
                className={fieldClass}
                placeholder="Ilimitado"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Tipo operativo CLF</span>
              <select
                name="clfEventType"
                defaultValue={call?.clfEventType ?? defaultClfEventType}
                className={fieldClass}
              >
                {CLF_EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Estado deseado en CLF</span>
              <select
                name="desiredClfStatus"
                defaultValue={call?.desiredClfStatus ?? "ACTIVE"}
                className={fieldClass}
              >
                <option value="ACTIVE">Abierta (ACTIVE)</option>
                <option value="CLOSED">Cerrada / borrador operativo (CLOSED)</option>
              </select>
              <span className="mt-1 block text-xs text-[var(--is-muted)]">
                No se publica automáticamente al guardar la actividad en InfoSpot.
              </span>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Email organizador (cuenta CLF)</span>
              <input
                name="organizerEmail"
                type="email"
                defaultValue={call?.organizerEmail ?? defaultOrganizerEmail}
                className={fieldClass}
                required={enabled}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Condiciones para fotógrafos</span>
              <textarea
                name="photographerTerms"
                rows={4}
                defaultValue={call?.photographerTerms ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Descripción operativa (CLF)</span>
              <textarea
                name="operationalDescription"
                rows={4}
                defaultValue={call?.operationalDescription ?? ""}
                className={fieldClass}
              />
            </label>
          </div>
        ) : (
          <>
            <input type="hidden" name="joinPolicy" value={call?.joinPolicy ?? "OPEN"} />
            <input type="hidden" name="visibility" value={call?.visibility ?? "PUBLIC"} />
            <input type="hidden" name="clfEventType" value={call?.clfEventType ?? defaultClfEventType} />
            <input type="hidden" name="desiredClfStatus" value={call?.desiredClfStatus ?? "ACTIVE"} />
            <input type="hidden" name="organizerEmail" value={call?.organizerEmail ?? defaultOrganizerEmail} />
          </>
        )}

        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-4 text-sm font-semibold"
        >
          Guardar configuración (InfoSpot)
        </button>
      </form>
      )}

      {canProvision && enabled && (status === "PENDING" || status === "BLOCKED" || status === "FAILED") ? (
        <form action={provisionAction}>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white"
          >
            {status === "FAILED"
              ? "Reintentar sincronización"
              : "Crear o actualizar convocatoria en CLF"}
          </button>
        </form>
      ) : null}

      {canProvision && status === "PROVISIONED" ? (
        <div className="flex flex-wrap gap-3">
          <form action={provisionAction}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-4 text-sm font-semibold"
            >
              Actualizar en CLF (sin duplicar)
            </button>
          </form>
          <form
            action={closeAction}
            onSubmit={(e) => {
              if (
                !window.confirm(
                  "¿Cerrar la convocatoria en ComprameLaFoto? No se borrarán inscripciones ni el evento.",
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-red-300 px-4 text-sm font-semibold text-red-800"
            >
              Cerrar convocatoria
            </button>
          </form>
        </div>
      ) : null}

      <NearbyNotifyPanel
        eventId={eventId}
        canNotify={canNotify}
        callOpen={display.status === "OPEN"}
        publicUrl={call?.publicUrl ?? null}
      />
    </section>
  );
}
