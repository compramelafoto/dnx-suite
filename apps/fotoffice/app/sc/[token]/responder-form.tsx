"use client";

import { useActionState } from "react";
import {
  answerInfoRequestAction,
  type TrackingFormState,
} from "@/app/actions/coverage-tracking";

const inicial: TrackingFormState = { error: null, ok: null };

export function ResponderForm({ token }: { token: string }) {
  const accion = answerInfoRequestAction.bind(null, token);
  const [state, formAction, pending] = useActionState(accion, inicial);

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

  return (
    <form action={formAction} className="space-y-3">
      <label className="fo-field-stack">
        <span className="fo-label">Tu respuesta</span>
        {/* `text-base` y no `text-sm`: en un teléfono, un campo con letra chica hace que el
            navegador acerque la pantalla al tocarlo y quien contesta pierde de vista la pregunta. */}
        <textarea name="respuesta" rows={4} required className="fo-input text-base" />
      </label>
      {state.error ? (
        <p
          role="alert"
          className="fo-alert-error rounded-[var(--fo-radius-sm)] p-3 text-sm leading-relaxed text-[var(--fo-danger)]"
        >
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="fo-btn fo-btn-primary min-h-11 w-full sm:w-auto" disabled={pending}>
        {pending ? "Enviando…" : "Enviar respuesta"}
      </button>
    </form>
  );
}
