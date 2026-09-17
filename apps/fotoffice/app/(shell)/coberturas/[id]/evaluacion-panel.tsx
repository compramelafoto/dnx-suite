"use client";

import { useActionState, useEffect, useState } from "react";
import { requestStatusStep } from "@/lib/coverages/states";
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
 *
 * **La pantalla dice en qué momento está el pedido antes de mostrar ningún botón.** Las acciones
 * cambian según el estado, y antes aparecían y desaparecían sin ninguna explicación: quien
 * coordina no tenía cómo saber por qué hoy veía «Empezar a evaluarla» y ayer no.
 *
 * **Tomar el pedido es lo que pasa casi siempre; rechazar es la excepción.** Por eso la acción
 * principal va sola y ancha, y las dos salidas menores —pedir un dato, no poder tomarlo— viven
 * detrás de un botón que recién entonces pide lo que hace falta escribir. Es el mismo patrón que
 * usa la bandeja de solicitudes de asociación (`components/membership/application-card.tsx`).
 */
export function EvaluacionPanel({
  id,
  status,
  puedeCoordinar,
  infoRequested,
  advertenciaOtraCobertura,
}: {
  id: string;
  status: string;
  puedeCoordinar: boolean;
  /** Lo último que se pidió, para mostrarlo mientras el estado sigue en `REQUIERE_INFO`. */
  infoRequested?: string | null;
  /**
   * Que ya haya otra cobertura del evento, si la organización lo contestó.
   *
   * Se lee **al lado del botón de tomar el pedido** y no sólo arriba en la ficha: es justo el
   * dato que cambia la decisión, y enterarse después de haber aprobado no sirve de nada.
   */
  advertenciaOtraCobertura?: string | null;
}) {
  const [estadoState, cambiarEstado, cambiando] = useActionState(
    changeRequestStatusAction,
    inicial,
  );
  const [infoState, pedirInfo, pidiendo] = useActionState(requestInfoAction, inicial);
  const [notaState, anotar, anotando] = useActionState(addNoteAction, inicial);

  const [pidiendoDato, setPidiendoDato] = useState(false);
  const [rechazando, setRechazando] = useState(false);

  const cerrada = ["RECHAZADA", "CERRADA", "CANCELADA_SOLICITANTE", "CANCELADA_ORGANIZACION"].includes(
    status,
  );
  const paso = requestStatusStep(status);
  const decidiendo = !cerrada && status === "EN_EVALUACION" && puedeCoordinar;

  return (
    <section className="fo-card space-y-5 p-5">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">Qué hacemos</h2>
        {paso ? (
          <>
            <p className="text-sm text-[var(--fo-text-secondary)]">{paso.donde}</p>
            <p className="fo-helper">
              <span className="font-semibold text-[var(--fo-text-secondary)]">Lo que sigue: </span>
              {paso.queSigue}
            </p>
          </>
        ) : null}
        {!cerrada && status === "EN_EVALUACION" && !puedeCoordinar ? (
          <p className="fo-helper">
            Esa decisión la toma una coordinadora. Vos podés pedirles un dato y dejar notas.
          </p>
        ) : null}
      </header>

      {/*
        El resultado de lo último que se hizo, pegado a las acciones que están justo abajo.

        No puede vivir adentro del bloque que lo disparó: estas dos acciones **cambian el estado**,
        y en cuanto el estado cambia ese bloque desaparece de la pantalla —«Tomar el pedido» ya no
        se ofrece sobre un pedido tomado— y se llevaría puesto el aviso que acaba de aparecer.
        Queda entonces al lado, arriba de las acciones y debajo del renglón que dice dónde está el
        pedido, que en el mismo movimiento se actualizó y cuenta lo mismo con otras palabras.

        La nota interna sí lleva el suyo adentro: no cambia de estado, así que su formulario sigue
        ahí para recibirlo.
      */}
      <Aviso state={estadoState} />
      <Aviso state={infoState} />

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
          <button
            type="submit"
            className="fo-btn fo-btn-primary min-h-12 w-full text-base sm:w-auto"
            disabled={cambiando}
          >
            {cambiando ? "Abriéndola…" : "Empezar a evaluarla"}
          </button>
        </form>
      ) : null}

      {decidiendo ? (
        <div className="space-y-4">
          {advertenciaOtraCobertura ? (
            <p className="fo-alert-warning rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed">
              <strong>Antes de decidir:</strong> {advertenciaOtraCobertura}
            </p>
          ) : null}

          <div className="space-y-2">
            <form action={cambiarEstado}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="to" value="APROBADA" />
              <button
                type="submit"
                className="fo-btn fo-btn-primary min-h-12 w-full text-base"
                disabled={cambiando}
              >
                {cambiando ? "Tomándolo…" : "Tomar el pedido"}
              </button>
            </form>
            <p className="fo-helper">
              Le avisamos a la organización por correo y el pedido queda listo para generar la
              cobertura.
            </p>
          </div>

          <div className="space-y-3 border-t border-[var(--fo-border)] pt-4">
            <p className="fo-helper">¿Todavía no se puede decidir?</p>
            <div className="flex flex-wrap gap-2">
              {!pidiendoDato ? (
                <button
                  type="button"
                  onClick={() => setPidiendoDato(true)}
                  className="fo-btn fo-btn-secondary min-h-11 text-sm"
                >
                  Pedirles un dato
                </button>
              ) : null}
              {!rechazando ? (
                <button
                  type="button"
                  onClick={() => setRechazando(true)}
                  className="fo-btn fo-btn-secondary min-h-11 text-sm"
                >
                  No podemos tomarlo
                </button>
              ) : null}
            </div>

            {/*
              Pedir información apunta a `REQUIERE_INFO`, y las transiciones cortan todo
              `from === to` (ver `planStatusChange`): por eso este bloque vive sólo acá, dentro de
              `EN_EVALUACION`. Ofrecerlo también en `REQUIERE_INFO` sería un botón que siempre
              falla, porque ya se está en ese estado.
            */}
            {pidiendoDato ? (
              <form action={pedirInfo} className="fo-field-stack">
                <input type="hidden" name="id" value={id} />
                <label className="fo-label" htmlFor="infoRequested">
                  Qué les falta mandarnos
                </label>
                <p className="fo-helper">
                  Lo reciben por correo y contestan desde su enlace. Mientras tanto el pedido
                  queda esperando.
                </p>
                <textarea id="infoRequested" name="infoRequested" rows={3} required className="fo-input" />
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="submit"
                    className="fo-btn fo-btn-primary min-h-11 text-sm"
                    disabled={pidiendo}
                  >
                    {pidiendo ? "Enviando…" : "Pedírselo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPidiendoDato(false)}
                    className="fo-btn fo-btn-ghost min-h-11 text-sm"
                  >
                    Mejor no
                  </button>
                </div>
              </form>
            ) : null}

            {rechazando ? (
              <form action={cambiarEstado} className="fo-field-stack">
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="to" value="RECHAZADA" />
                <label className="fo-label" htmlFor="reason">
                  Por qué no podemos tomarlo
                </label>
                <p className="fo-helper">
                  Se lo mandamos tal como lo escribas. Un rechazo no se reabre: si insisten con
                  datos nuevos, es un pedido nuevo.
                </p>
                <textarea id="reason" name="reason" rows={3} required className="fo-input" />
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="submit"
                    className="fo-btn fo-btn-danger-outline min-h-11 text-sm"
                    disabled={cambiando}
                  >
                    {cambiando ? "Avisando…" : "Avisarles que no podemos"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRechazando(false)}
                    className="fo-btn fo-btn-ghost min-h-11 text-sm"
                  >
                    Mejor no
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      {!cerrada && status === "REQUIERE_INFO" ? (
        <p className="fo-alert-warning rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed">
          Les pedimos: «{infoRequested}»
        </p>
      ) : null}

      <details className="border-t border-[var(--fo-border)] pt-4">
        <summary className="cursor-pointer text-sm font-medium">Dejar una nota interna</summary>
        <form action={anotar} className="fo-field-stack pt-3">
          <input type="hidden" name="id" value={id} />
          <label className="fo-label" htmlFor="note">
            La nota
          </label>
          <p className="fo-helper">Solo la vemos nosotros. La organización nunca la ve.</p>
          <textarea id="note" name="note" rows={3} required className="fo-input" />
          <div className="pt-1">
            <button
              type="submit"
              className="fo-btn fo-btn-secondary min-h-11 text-sm"
              disabled={anotando}
            >
              {anotando ? "Anotando…" : "Anotar"}
            </button>
          </div>
          <Aviso state={notaState} />
        </form>
      </details>
    </section>
  );
}

/** Cuántos segundos queda a la vista un aviso de que algo salió bien. */
const SEGUNDOS_VISIBLE = 12;

/**
 * El resultado de UNA acción, al lado del botón que la disparó.
 *
 * Los tres avisos vivían juntos arriba de la tarjeta, lejos de lo que los había provocado: quien
 * anotaba una nota leía «Listo.» a diez centímetros, arriba de todo, sin saber a cuál de las tres
 * cosas le estaba contestando.
 *
 * Lo que salió bien se borra solo: el estado de una Server Action sobrevive a la recarga de la
 * pantalla, así que «lo tomamos» seguía ahí media hora después, contando algo que ya no estaba
 * pasando. Un error y un aviso a medias **no** se borran: son justo los que hay que leer, y los
 * que a veces piden hacer algo.
 */
function Aviso({ state }: { state: PanelState }) {
  /*
   * Se guarda CUÁL aviso se apagó, y no un simple "visible: sí/no".
   *
   * Con un booleano habría que volver a encenderlo desde el efecto en cuanto llega un resultado
   * nuevo, y eso es un `setState` sincrónico adentro de un efecto: React lo desaconseja y el lint
   * del proyecto lo rechaza. Comparando contra el objeto que devolvió la acción, un resultado
   * nuevo —que siempre es un objeto nuevo— se ve solo, sin encender nada.
   */
  const [apagado, setApagado] = useState<PanelState | null>(null);

  useEffect(() => {
    if (!state.ok) return;
    const reloj = setTimeout(() => setApagado(state), SEGUNDOS_VISIBLE * 1000);
    return () => clearTimeout(reloj);
  }, [state]);

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
  if (state.ok && apagado !== state) {
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
