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
    return <p className="text-sm text-[var(--fo-muted)]">{state.ok}</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Tu respuesta</span>
        <textarea
          name="respuesta"
          rows={4}
          required
          className="w-full rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] px-3 py-2 text-base"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="fo-btn min-h-11" disabled={pending}>
        {pending ? "Enviando…" : "Enviar respuesta"}
      </button>
    </form>
  );
}
