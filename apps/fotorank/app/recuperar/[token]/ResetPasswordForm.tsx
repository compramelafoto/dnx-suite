"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FormField, inputAuth } from "../../components/ui/form";
import {
  resetFotorankPasswordAction,
  type FotorankResetFormState,
} from "../actions";

const initialState: FotorankResetFormState = { error: null, info: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="fr-btn fr-btn-primary w-full py-4 text-base font-semibold"
    >
      {pending ? "Guardando…" : "Guardar contraseña"}
    </button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetFotorankPasswordAction, initialState);

  return (
    <form action={formAction} className="w-full">
      <input type="hidden" name="token" value={token} />
      <FormField id="password" label="Nueva contraseña" required layout="auth">
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputAuth}
        />
      </FormField>
      <FormField id="passwordConfirm" label="Repetir contraseña" required layout="auth">
        <input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
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
      <SubmitButton />
    </form>
  );
}
