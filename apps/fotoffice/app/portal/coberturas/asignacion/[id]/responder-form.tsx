"use client";

import { useActionState } from "react";
import {
  responderInvitacionAction,
  type ResponderInvitacionState,
} from "@/app/actions/coverage-portal";

const inicial: ResponderInvitacionState = { error: null, ok: null, aviso: null };

/**
 * Los dos botones: confirmo, o no puedo.
 *
 * Esta pantalla se abre desde el teléfono, con un enlace que llegó por WhatsApp: una sola
 * columna, botones anchos de 44 px para arriba —lo que un dedo acierta sin apuntar— y los dos
 * deshabilitados mientras se envía. Con la conexión de cualquier lado, un segundo toque antes
 * de que vuelva la respuesta es un caso real; el servidor lo frena igual (ver
 * `responderInvitacionAction`), pero evitarlo acá evita también el mensaje de más.
 *
 * "No puedo ir" y no "rechazar": nadie está rechazando nada, está avisando que no llega. Es
 * voluntariado.
 *
 * Un solo formulario y un solo `useActionState` para los dos botones: cada botón lleva
 * `name="respuesta"` con su propio `value`, que es lo que le dice al servidor cuál se apretó.
 * Así los dos comparten el mismo estado de envío y no se puede apretar "confirmo" mientras "no
 * puedo" todavía está viajando.
 */
export function ResponderForm({ assignmentId }: { assignmentId: string }) {
  const [state, responder, enviando] = useActionState(responderInvitacionAction, inicial);

  if (state.ok) {
    return <p className="text-sm font-medium text-[var(--fo-success)]">{state.ok}</p>;
  }
  if (state.aviso) {
    return <p className="text-sm text-[var(--fo-muted)]">{state.aviso}</p>;
  }

  return (
    <form action={responder} className="space-y-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      {state.error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        name="respuesta"
        value="CONFIRMO"
        className="fo-btn fo-btn-primary min-h-11 w-full"
        disabled={enviando}
      >
        {enviando ? "Enviando…" : "Sí, cuenten conmigo"}
      </button>
      <button
        type="submit"
        name="respuesta"
        value="NO_PUEDO"
        className="fo-btn fo-btn-secondary min-h-11 w-full"
        disabled={enviando}
      >
        {enviando ? "Enviando…" : "Esta vez no puedo"}
      </button>
    </form>
  );
}
