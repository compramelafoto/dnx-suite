"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FormField, inputAuth } from "../components/ui/form";
import {
  requestFotorankPasswordResetAction,
  type FotorankResetFormState,
} from "./actions";

const initialState: FotorankResetFormState = { error: null, info: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="fr-btn fr-btn-primary w-full py-4 text-base font-semibold"
    >
      {pending ? "Enviando…" : "Enviar enlace"}
    </button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    requestFotorankPasswordResetAction,
    initialState,
  );

  return (
    <form action={formAction} className="w-full">
      <FormField id="email" label="Email" required layout="auth">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputAuth}
        />
      </FormField>
      {state.error ? (
        <div
          className="mb-8 rounded-xl border border-red-500/35 bg-red-500/10 px-5 py-4 text-center text-sm text-red-200"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}
      {state.info ? (
        <div
          className="mb-8 rounded-xl border border-fr-border bg-fr-card px-5 py-4 text-center text-sm text-fr-muted"
          role="status"
        >
          {state.info}
        </div>
      ) : null}
      <SubmitButton />
    </form>
  );
}
