"use client";

import { useActionState } from "react";
import { EstadoConvocatoriaChip } from "@/components/coberturas/estado-chip";
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
  reenviarAvisoConvocatoriaAction,
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
 *
 * **Publicar es el botón grande; guardar el borrador, el chico.** Son dos cosas de peso muy
 * distinto: guardar no lo ve nadie, publicar le escribe a todos los colaboradores de la
 * institución. Cuando los dos se veían igual, el que manda cincuenta correos quedaba a un clic de
 * distracción del que no manda ninguno.
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
  const [reenviarState, reenviar, reenviando] = useActionState(
    reenviarAvisoConvocatoriaAction,
    inicial,
  );

  if (!call) {
    // La misma regla que aplica el servidor, no una lista de estados repetida acá: desde que una
    // invitación directa mueve la cobertura a BUSCANDO_EQUIPO, comparar contra "PLANIFICADA" a
    // mano escondía el formulario en un caso donde la acción sí lo habría aceptado.
    const creable = puedeCrearseConvocatoria({ coverageStatus, yaExiste: false });

    if (!creable.ok) {
      return (
        <section className="fo-card space-y-2 p-5">
          <h2 className="text-base font-semibold">La convocatoria</h2>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{creable.error}</p>
        </section>
      );
    }

    if (!puedeCoordinar) {
      return (
        <section className="fo-card space-y-2 p-5">
          <h2 className="text-base font-semibold">La convocatoria</h2>
          <p className="text-sm text-[var(--fo-muted)]">Todavía no se creó la convocatoria.</p>
        </section>
      );
    }

    return (
      <section className="fo-card space-y-5 p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">La convocatoria</h2>
          <p className="fo-helper">
            Es el aviso con el que se busca gente para esta cobertura. Se crea como borrador: no
            la ve nadie hasta que la publiques.
          </p>
        </div>
        <Aviso state={crearState} />
        <form action={crear} className="space-y-5">
          <input type="hidden" name="coverageId" value={coverageId} />
          <CamposConvocatoria />
          <button
            type="submit"
            className="fo-btn fo-btn-primary min-h-12 w-full text-base sm:w-auto"
            disabled={creando}
          >
            {creando ? "Creando…" : "Crear el borrador"}
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
    <section className="fo-card space-y-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">La convocatoria</h2>
        <EstadoConvocatoriaChip status={call.status} />
      </div>

      {!editable ? (
        <div className="space-y-4">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Dato label="Título" valor={call.title} ancho />
            <Dato label="Qué se cuenta" valor={call.publicSummary ?? "—"} ancho />
            <Dato label="Solo para quien queda asignado" valor={call.privateBriefing ?? "—"} ancho />
            <Dato
              label="Cierre de postulaciones"
              valor={call.applicationsCloseAtDisplay ?? "Sin plazo"}
            />
            <Dato label="Urgencia" valor={URGENCIA_LABELS[call.urgency] ?? call.urgency} />
            <Dato
              label="A quién se le muestra"
              valor={VISIBILIDAD_LABELS[call.visibility] ?? call.visibility}
            />
            {call.visibility !== "TODOS" && call.visibilityValues.length > 0 ? (
              <Dato label="Zonas o especialidades" valor={call.visibilityValues.join(", ")} />
            ) : null}
            {call.publishedAtDisplay ? (
              <Dato label="Publicada" valor={call.publishedAtDisplay} />
            ) : null}
          </dl>

          {/* El aviso de la publicación se sigue viendo acá después de publicar: cuando la
              convocatoria pasa a PUBLICADA el formulario de arriba desaparece, y con él
              desaparecía el único renglón que decía que algunos correos no habían salido. */}
          <Aviso state={publicarState} />

          {call.status === "PUBLICADA" && puedeCoordinar ? (
            <div className="space-y-2 border-t border-[var(--fo-border)] pt-4">
              <Aviso state={reenviarState} />
              <form action={reenviar}>
                <input type="hidden" name="callId" value={call.id} />
                <button
                  type="submit"
                  className="fo-btn fo-btn-secondary min-h-11 text-sm"
                  disabled={reenviando}
                >
                  {reenviando ? "Reenviando…" : "Reenviar el aviso a quienes no lo recibieron"}
                </button>
              </form>
              <p className="fo-helper">
                Le escribe solo a quien todavía no lo recibió. Se puede apretar las veces que haga
                falta: a nadie le llega dos veces.
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <Aviso state={editarState} />
          <form action={editar} className="space-y-5">
            <input type="hidden" name="callId" value={call.id} />
            <CamposConvocatoria valores={call} />
            <button
              type="submit"
              className="fo-btn fo-btn-secondary min-h-11 text-sm"
              disabled={editando}
            >
              {editando ? "Guardando…" : "Guardar el borrador"}
            </button>
          </form>

          <div className="space-y-2 border-t border-[var(--fo-border)] pt-4">
            <Aviso state={publicarState} />
            {!publicable.ok ? (
              <p className="fo-alert-warning rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed">
                Todavía no se puede publicar: {publicable.error}
              </p>
            ) : null}
            <form action={publicar}>
              <input type="hidden" name="callId" value={call.id} />
              <button
                type="submit"
                className="fo-btn fo-btn-primary min-h-12 w-full text-base sm:w-auto"
                disabled={publicando || !publicable.ok}
              >
                {publicando ? "Publicando…" : "Publicar la convocatoria"}
              </button>
            </form>
            <p className="fo-helper">
              Al publicarla le llega un aviso por correo a los colaboradores que la puedan ver, y
              desde ese momento se pueden anotar. Después ya no se edita.
            </p>
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
        <span className="fo-label">Qué se cuenta</span>
        <span className="fo-helper">
          Lo ve cualquier colaborador que reciba la convocatoria, se anote o no. Con esto decide
          si puede y si quiere.
        </span>
        <textarea
          name="publicSummary"
          rows={3}
          defaultValue={valores?.publicSummary ?? ""}
          className="fo-input"
        />
      </label>
      <label className="fo-field-stack sm:col-span-2">
        <span className="fo-label">Solo para quien queda asignado</span>
        <span className="fo-helper">
          El teléfono de emergencia, el contacto del día, y qué autorizó la organización a
          difundir. Nadie más lo lee.
        </span>
        <textarea
          name="privateBriefing"
          rows={3}
          defaultValue={valores?.privateBriefing ?? ""}
          className="fo-input"
        />
      </label>
      <label className="fo-field-stack">
        <span className="fo-label">Cierre de postulaciones</span>
        <span className="fo-helper">Opcional. Sin fecha, queda abierta.</span>
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
        <span className="fo-label">Zonas o especialidades</span>
        <span className="fo-helper">Una por línea. Sólo se usa si arriba elegiste una de las dos.</span>
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

function Dato({ label, valor, ancho }: { label: string; valor: string; ancho?: boolean }) {
  return (
    <div className={ancho ? "sm:col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">{label}</dt>
      <dd className="text-sm leading-relaxed">{valor}</dd>
    </div>
  );
}

/**
 * El resultado de una acción: el error primero, después lo que salió a medias, y al final lo que
 * salió bien. Es el mismo criterio del panel de solicitudes y del panel del equipo.
 */
function Aviso({ state }: { state: ConvocatoriaState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="fo-alert-error rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed text-[var(--fo-danger)]"
      >
        {state.error}
      </p>
    );
  }
  if (state.warn) {
    return (
      <p
        role="alert"
        className="fo-alert-warning rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed"
      >
        {state.warn}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p
        role="status"
        className="fo-alert-success rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed"
      >
        {state.ok}
      </p>
    );
  }
  return null;
}
