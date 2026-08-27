"use client";

import { useActionState } from "react";
import {
  createCarnetTemplateAction,
  type CarnetTemplateState,
} from "@/app/actions/carnet-template";

const initial: CarnetTemplateState = { error: null, ok: null };

/** Trae el diseño de fábrica del carnet al editor, para que la institución pueda cambiarlo. */
export function CreateCarnetTemplate() {
  const [state, action, pending] = useActionState(
    async () => createCarnetTemplateAction(),
    initial,
  );

  return (
    <form action={action} className="space-y-2">
      <button type="submit" disabled={pending} className="fo-btn fo-btn-secondary text-sm">
        {pending ? "Creando…" : "Traer el diseño del carnet"}
      </button>
      {state.error ? <p className="text-sm text-[var(--fo-danger)]">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-[var(--fo-success)]">{state.ok}</p> : null}
    </form>
  );
}
