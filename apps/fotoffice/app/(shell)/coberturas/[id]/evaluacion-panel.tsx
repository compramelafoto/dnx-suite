"use client";

import { useActionState } from "react";
import {
  addNoteAction,
  changeRequestStatusAction,
  requestInfoAction,
  type PanelState,
} from "../actions";

const inicial: PanelState = { error: null, ok: null };

/**
 * Lo que la coordinación puede hacer con una solicitud.
 *
 * `puedeCoordinar` esconde los botones de aprobar y rechazar para quien solo revisa. **No es
 * el control**: las acciones vuelven a verificar el rol en el servidor. Esto es cortesía, para
 * no ofrecer lo que después va a rebotar.
 */
export function EvaluacionPanel({
  id,
  status,
  puedeCoordinar,
  infoRequested,
}: {
  id: string;
  status: string;
  puedeCoordinar: boolean;
  /** Lo último que se pidió, para mostrarlo mientras el estado sigue en `REQUIERE_INFO`. */
  infoRequested?: string | null;
}) {
  const [estadoState, cambiarEstado, cambiando] = useActionState(
    changeRequestStatusAction,
    inicial,
  );
  const [infoState, pedirInfo, pidiendo] = useActionState(requestInfoAction, inicial);
  const [notaState, anotar, anotando] = useActionState(addNoteAction, inicial);

  const cerrada = ["RECHAZADA", "CERRADA", "CANCELADA_SOLICITANTE", "CANCELADA_ORGANIZACION"].includes(
    status,
  );

  return (
    <section className="fo-card space-y-6 p-5">
      <h2 className="text-base font-semibold">Qué hacemos</h2>

      <Aviso state={estadoState} />
      <Aviso state={infoState} />
      <Aviso state={notaState} />

      {/*
        Empezar a evaluar (RECIBIDA → EN_EVALUACION) no está detrás de `puedeCoordinar`: es
        trabajo de secretaría, alcanza con revisar. Quien llegó a esta ficha ya pasó
        `requireCoveragesReviewer` en el servidor, y `changeRequestStatusAction` vuelve a exigir
        el guard que corresponde según el destino (ver `transitionNeedsCoordinator`).
      */}
      {!cerrada && status === "RECIBIDA" ? (
        <form action={cambiarEstado}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="to" value="EN_EVALUACION" />
          <button type="submit" className="fo-btn min-h-11" disabled={cambiando}>
            Empezar a evaluarla
          </button>
        </form>
      ) : null}

      {/*
        Sólo en `EN_EVALUACION`: pedir información apunta a `REQUIERE_INFO`, y las transiciones
        cortan todo `from === to` (ver `planStatusChange`). Mostrar este formulario también en
        `REQUIERE_INFO` ofrecería un botón que siempre falla, porque ya se está en ese estado.
      */}
      {!cerrada && status === "EN_EVALUACION" ? (
        <form action={pedirInfo} className="space-y-2">
          <input type="hidden" name="id" value={id} />
          <label className="block space-y-1">
            <span className="text-sm font-medium">Pedirles un dato</span>
            <textarea
              name="infoRequested"
              rows={2}
              required
              className="w-full rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] px-3 py-2 text-sm"
            />
          </label>
          <button type="submit" className="fo-btn fo-btn-secondary min-h-11" disabled={pidiendo}>
            Pedir información
          </button>
        </form>
      ) : null}

      {!cerrada && status === "REQUIERE_INFO" ? (
        <p className="text-sm text-[var(--fo-muted)]">
          Le pedimos: «{infoRequested}». Estamos esperando su respuesta.
        </p>
      ) : null}

      {!cerrada && status === "EN_EVALUACION" && puedeCoordinar ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <form action={cambiarEstado} className="sm:flex-1">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="to" value="APROBADA" />
            <button type="submit" className="fo-btn min-h-11 w-full" disabled={cambiando}>
              Tomar el pedido
            </button>
          </form>
          <form action={cambiarEstado} className="space-y-2 sm:flex-1">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="to" value="RECHAZADA" />
            <textarea
              name="reason"
              rows={2}
              required
              placeholder="Por qué no podemos tomarlo. Se lo mandamos."
              className="w-full rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="fo-btn fo-btn-secondary min-h-11 w-full"
              disabled={cambiando}
            >
              No podemos tomarlo
            </button>
          </form>
        </div>
      ) : null}

      <form action={anotar} className="space-y-2">
        <input type="hidden" name="id" value={id} />
        <label className="block space-y-1">
          <span className="text-sm font-medium">Nota interna</span>
          <span className="block text-xs text-[var(--fo-muted)]">
            Solo la vemos nosotros. La organización nunca la ve.
          </span>
          <textarea
            name="note"
            rows={2}
            required
            className="w-full rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] px-3 py-2 text-sm"
          />
        </label>
        <button type="submit" className="fo-btn fo-btn-secondary min-h-11" disabled={anotando}>
          Anotar
        </button>
      </form>
    </section>
  );
}

function Aviso({ state }: { state: PanelState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-[var(--fo-danger)]">
        {state.error}
      </p>
    );
  }
  if (state.warn) {
    return <p className="text-sm text-[var(--fo-warning,#b45309)]">{state.warn}</p>;
  }
  if (state.ok) return <p className="text-sm text-[var(--fo-muted)]">{state.ok}</p>;
  return null;
}
