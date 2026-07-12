"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { acceptInvitationAction, type IdentityFormState } from "@/app/actions/identity";

const initial: IdentityFormState = { ok: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-[var(--is-bg)] disabled:opacity-60"
    >
      {pending ? "Activando…" : "Crear cuenta y entrar"}
    </button>
  );
}

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitationAction, initial);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="token" value={token} />
      {state.message ? (
        <p
          className={`rounded-[var(--is-radius-sm)] border px-4 py-3 text-sm ${
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
        <label htmlFor="name" className="block text-sm font-semibold">
          Nombre
        </label>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          autoComplete="name"
          className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] px-4 text-sm"
        />
      </div>

      <div className="space-y-3">
        <label htmlFor="password" className="block text-sm font-semibold">
          Contraseña
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
        <p className="text-xs text-[var(--is-muted)]">Mínimo 8 caracteres. No la compartimos por email.</p>
      </div>

      <div className="space-y-3">
        <label htmlFor="passwordConfirm" className="block text-sm font-semibold">
          Confirmar contraseña
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
