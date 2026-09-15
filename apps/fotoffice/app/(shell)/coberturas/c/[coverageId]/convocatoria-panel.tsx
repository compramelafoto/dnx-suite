"use client";

import { useActionState } from "react";
import type { EstadoDeRol } from "@/lib/coverages/cupos";
import {
  puedeCrearseConvocatoria,
  puedeEditarseConvocatoria,
  puedePublicarse,
} from "@/lib/coverages/convocatoria";
import {
  crearConvocatoriaAction,
  editarConvocatoriaAction,
  publicarConvocatoriaAction,
  type ConvocatoriaState,
} from "./actions";

const inicial: ConvocatoriaState = { error: null, ok: null };

const VISIBILIDAD_LABELS: Record<string, string> = {
  TODOS: "Todos los colaboradores",
  POR_ZONA: "Solo por zona",
  POR_ESPECIALIDAD: "Solo por especialidad",
};

const URGENCIA_LABELS: Record<string, string> = {
  NORMAL: "Normal",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

type CallProps = {
  id: string;
  title: string;
  publicSummary: string | null;
  privateBriefing: string | null;
  visibility: string;
  visibilityValues: string[];
  applicationsCloseAtInput: string;
  applicationsCloseAtDisplay: string | null;
  urgency: string;
  status: string;
  statusLabel: string;
  publishedAtDisplay: string | null;
} | null;

/**
 * Crear, editar y publicar la convocatoria de esta cobertura.
 *
 * `puedeCoordinar` esconde los formularios para quien solo revisa — igual que en
 * `EvaluacionPanel`— y las tres acciones (`crearConvocatoriaAction`, `editarConvocatoriaAction`,
 * `publicarConvocatoriaAction`) vuelven a pedir `requireCoveragesCoordinator()` en el servidor:
 * esto es cortesía, no el control.
 */
export function ConvocatoriaPanel({
  coverageId,
  coverageStatus,
  roles,
  call,
  puedeCoordinar,
}: {
  coverageId: string;
  coverageStatus: string;
  roles: EstadoDeRol[];
  call: CallProps;
  puedeCoordinar: boolean;
}) {
  const [crearState, crear, creando] = useActionState(crearConvocatoriaAction, inicial);
  const [editarState, editar, editando] = useActionState(editarConvocatoriaAction, inicial);
  const [publicarState, publicar, publicando] = useActionState(publicarConvocatoriaAction, inicial);

  if (!call) {
    // La misma regla que aplica el servidor, no una lista de estados repetida acá: desde que una
    // invitación directa mueve la cobertura a BUSCANDO_EQUIPO, comparar contra "PLANIFICADA" a
    // mano escondía el formulario en un caso donde la acción sí lo habría aceptado.
    const creable = puedeCrearseConvocatoria({ coverageStatus, yaExiste: false });

    if (!creable.ok) {
      return (
        <section className="fo-card space-y-2 p-5">
          <h2 className="text-base font-semibold">Convocatoria</h2>
          <p className="text-sm text-[var(--fo-muted)]">{creable.error}</p>
        </section>
      );
    }

    if (!puedeCoordinar) {
      return (
        <section className="fo-card space-y-2 p-5">
          <h2 className="text-base font-semibold">Convocatoria</h2>
          <p className="text-sm text-[var(--fo-muted)]">Todavía no se creó la convocatoria.</p>
        </section>
      );
    }

    return (
      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Crear la convocatoria</h2>
        {crearState.error ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            {crearState.error}
          </p>
        ) : null}
        <form action={crear} className="space-y-4">
          <input type="hidden" name="coverageId" value={coverageId} />
          <CamposConvocatoria />
          <button type="submit" className="fo-btn min-h-11" disabled={creando}>
            {creando ? "Creando…" : "Crear convocatoria (borrador)"}
          </button>
        </form>
      </section>
    );
  }

  // La misma función que aplica la acción del servidor, por el mismo motivo que un poco más
  // arriba: la regla de cuándo se puede editar vive en `convocatoria.ts` y se lee de ahí, no
  // comparada contra un estado escrito a mano que el día que cambie quede desfasado.
  const editable = puedeEditarseConvocatoria(call.status) && puedeCoordinar;
  const publicable = puedePublicarse({ title: call.title }, roles);

  return (
    <section className="fo-card space-y-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Convocatoria</h2>
        <span className="text-sm text-[var(--fo-muted)]">{call.statusLabel}</span>
      </div>

      {!editable ? (
        <div className="space-y-2 text-sm">
          <Dato label="Título" valor={call.title} />
          <Dato label="Qué se cuenta" valor={call.publicSummary ?? "—"} />
          <Dato label="Solo para quien queda asignado" valor={call.privateBriefing ?? "—"} />
          <Dato label="Cierre de postulaciones" valor={call.applicationsCloseAtDisplay ?? "Sin plazo"} />
          <Dato label="Urgencia" valor={URGENCIA_LABELS[call.urgency] ?? call.urgency} />
          <Dato label="A quién se le muestra" valor={VISIBILIDAD_LABELS[call.visibility] ?? call.visibility} />
          {call.visibility !== "TODOS" && call.visibilityValues.length > 0 ? (
            <Dato label="Zonas o especialidades" valor={call.visibilityValues.join(", ")} />
          ) : null}
          {call.publishedAtDisplay ? <Dato label="Publicada" valor={call.publishedAtDisplay} /> : null}
        </div>
      ) : (
        <>
          {editarState.error ? (
            <p role="alert" className="text-sm text-[var(--fo-danger)]">
              {editarState.error}
            </p>
          ) : null}
          {editarState.ok ? <p className="text-sm text-[var(--fo-muted)]">{editarState.ok}</p> : null}
          <form action={editar} className="space-y-4">
            <input type="hidden" name="callId" value={call.id} />
            <CamposConvocatoria valores={call} />
            <button type="submit" className="fo-btn fo-btn-secondary min-h-11" disabled={editando}>
              {editando ? "Guardando…" : "Guardar cambios"}
            </button>
          </form>

          <div className="space-y-2 border-t border-[var(--fo-border)] pt-4">
            {publicarState.error ? (
              <p role="alert" className="text-sm text-[var(--fo-danger)]">
                {publicarState.error}
              </p>
            ) : null}
            {/* Publicada, pero algún aviso a los colaboradores no salió: ni verde ni rojo. */}
            {publicarState.warn ? (
              <p className="text-sm text-[var(--fo-warning,#b45309)]">{publicarState.warn}</p>
            ) : null}
            {!publicable.ok ? (
              <p className="text-sm text-[var(--fo-muted)]">{publicable.error}</p>
            ) : null}
            <form action={publicar}>
              <input type="hidden" name="callId" value={call.id} />
              <button
                type="submit"
                className="fo-btn min-h-11"
                disabled={publicando || !publicable.ok}
              >
                {publicando ? "Publicando…" : "Publicar convocatoria"}
              </button>
            </form>
          </div>
        </>
      )}
    </section>
  );
}

function CamposConvocatoria({
  valores,
}: {
  valores?: {
    title: string;
    publicSummary: string | null;
    privateBriefing: string | null;
    visibility: string;
    visibilityValues: string[];
    applicationsCloseAtInput: string;
    urgency: string;
  };
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="fo-field-stack sm:col-span-2">
        <span className="fo-label">Título</span>
        <input name="title" defaultValue={valores?.title ?? ""} required className="fo-input" />
      </label>
      <label className="fo-field-stack sm:col-span-2">
        <span className="fo-label">Qué se cuenta (lo ve cualquier colaborador)</span>
        <textarea
          name="publicSummary"
          rows={2}
          defaultValue={valores?.publicSummary ?? ""}
          className="fo-input"
        />
      </label>
      <label className="fo-field-stack sm:col-span-2">
        <span className="fo-label">
          Solo para quien queda asignado (teléfono de emergencia, contacto del día)
        </span>
        <textarea
          name="privateBriefing"
          rows={2}
          defaultValue={valores?.privateBriefing ?? ""}
          className="fo-input"
        />
      </label>
      <label className="fo-field-stack">
        <span className="fo-label">Cierre de postulaciones</span>
        <input
          type="datetime-local"
          name="applicationsCloseAt"
          defaultValue={valores?.applicationsCloseAtInput ?? ""}
          className="fo-input"
        />
      </label>
      <label className="fo-field-stack">
        <span className="fo-label">Urgencia</span>
        <select name="urgency" defaultValue={valores?.urgency ?? "NORMAL"} className="fo-input">
          {Object.entries(URGENCIA_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="fo-field-stack">
        <span className="fo-label">A quién se le muestra</span>
        <select
          name="visibility"
          defaultValue={valores?.visibility ?? "TODOS"}
          className="fo-input"
        >
          {Object.entries(VISIBILIDAD_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="fo-field-stack">
        <span className="fo-label">Zonas o especialidades (una por línea, si aplica)</span>
        <textarea
          name="visibilityValues"
          rows={2}
          defaultValue={(valores?.visibilityValues ?? []).join("\n")}
          className="fo-input"
        />
      </label>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <p>
      <span className="text-[var(--fo-muted)]">{label}: </span>
      {valor}
    </p>
  );
}
