"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resetPasswordAction, type IdentityFormState } from "@/app/actions/identity";

const initial: IdentityFormState = { ok: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-[var(--is-bg)] disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Guardar y entrar"}
    </button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, initial);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="token" value={token} />
      {state.message ? (
        <p
          className="rounded-[var(--is-radius-sm)] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <div className="space-y-3">
        <label htmlFor="password" className="block text-sm font-semibold">
          Nueva contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] px-4 text-sm"
        />
      </div>

      <div className="space-y-3">
        <label htmlFor="passwordConfirm" className="block text-sm font-semibold">
          Confirmar
        </label>
        <input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] px-4 text-sm"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
