"use client";

import { useState } from "react";
import {
  savePhotographerCallAndRedirect,
  provisionPhotographerCallAndRedirect,
  closePhotographerCallAndRedirect,
} from "@/app/actions/photographer-call";
import { CLF_EVENT_TYPES } from "@/lib/clf-event-provisioning/category-type-map";

const fieldClass =
  "mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white px-3 py-3 text-base text-[var(--is-text)] outline-none focus:border-[var(--is-accent)] focus:ring-2 focus:ring-[var(--is-accent)]/20";

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
};

const STATUS_COPY: Record<string, string> = {
  NOT_REQUESTED: "Convocatoria no configurada",
  PENDING: "Configuración lista",
  BLOCKED: "No puede crearse todavía",
  PROVISIONING: "Creando convocatoria…",
  PROVISIONED: "Convocatoria activa en ComprameLaFoto",
  FAILED: "No se pudo crear la convocatoria",
  CLOSED: "Convocatoria cerrada",
};

export function PhotographerCallPanel({
  eventId,
  call,
  defaultOrganizerEmail,
  defaultClfEventType,
  missingGeoref,
  canProvision,
}: Props) {
  const [enabled, setEnabled] = useState(call?.enabled ?? false);
  const status = call?.provisioningStatus ?? "NOT_REQUESTED";

  const saveAction = savePhotographerCallAndRedirect.bind(null, eventId);
  const provisionAction = provisionPhotographerCallAndRedirect.bind(null, eventId);
  const closeAction = closePhotographerCallAndRedirect.bind(null, eventId);

  return (
    <section className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Convocatoria de fotógrafos</h2>
        <p className="mt-1 text-sm text-[var(--is-muted)]">
          Configurá la convocatoria en Info Spot. La inscripción ocurre en ComprameLaFoto.
        </p>
        <p className="mt-2 text-sm font-medium text-[var(--is-text-secondary)]">
          {STATUS_COPY[status] ?? status}
        </p>
      </div>

      {missingGeoref ? (
        <p className="rounded-[var(--is-radius-sm)] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Falta georreferenciar el evento
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

      {call?.publicUrl ? (
        <p className="text-sm">
          <a
            href={call.publicUrl}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-[var(--is-accent)] hover:underline"
          >
            Ver página pública
          </a>
          {call.clfEventId ? (
            <span className="text-[var(--is-muted)]"> · CLF #{call.clfEventId}</span>
          ) : null}
        </p>
      ) : null}

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
            <span className="font-semibold">Convocar fotógrafos para este evento</span>
            <span className="block text-[var(--is-muted)]">
              No elimina el Event CLF al desmarcar; si ya está provisionado usá «Cerrar convocatoria».
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
              <span className="text-sm font-medium">Estado inicial CLF</span>
              <select
                name="desiredClfStatus"
                defaultValue={call?.desiredClfStatus ?? "ACTIVE"}
                className={fieldClass}
              >
                <option value="ACTIVE">Abierta (ACTIVE)</option>
                <option value="CLOSED">Cerrada (CLOSED)</option>
              </select>
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
          Guardar configuración
        </button>
      </form>

      {canProvision && enabled && (status === "PENDING" || status === "BLOCKED" || status === "FAILED") ? (
        <form action={provisionAction}>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white"
          >
            {status === "FAILED" ? "Reintentar" : "Crear convocatoria en ComprameLaFoto"}
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
              Actualizar configuración
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
    </section>
  );
}
