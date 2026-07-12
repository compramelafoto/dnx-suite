"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestPasswordResetAction, type IdentityFormState } from "@/app/actions/identity";

const initial: IdentityFormState = { ok: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-[var(--is-bg)] disabled:opacity-60"
    >
      {pending ? "Enviando…" : "Enviar enlace"}
    </button>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, initial);

  return (
    <form action={action} className="space-y-6">
      {state.message ? (
        <p
          className={`rounded-[var(--is-radius-sm)] border px-4 py-3 text-sm leading-relaxed ${
            state.ok
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-red-300 bg-red-50 text-red-800"
          }`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <div className="space-y-3">
        <label htmlFor="email" className="block text-sm font-semibold">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] px-4 text-sm"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
