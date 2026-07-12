"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginFormState } from "./actions";

const initial: LoginFormState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-[var(--is-bg)] disabled:opacity-60"
    >
      {pending ? "Ingresando…" : "Ingresar"}
    </button>
  );
}

export function LoginForm({
  next,
  deniedMessage,
}: {
  next: string;
  deniedMessage?: string | null;
}) {
  const [state, action] = useActionState(loginAction, initial);
  const error = state.error ?? deniedMessage ?? null;

  return (
    <form action={action} className="mx-auto w-full max-w-md space-y-8">
      <input type="hidden" name="next" value={next} />

      {error ? (
        <p
          className="rounded-[var(--is-radius-sm)] border border-red-300 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        <label htmlFor="email" className="block text-sm font-semibold text-[var(--is-text)]">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] px-4 text-sm"
          placeholder="tu@email.com"
        />
      </div>

      <div className="space-y-3">
        <label htmlFor="password" className="block text-sm font-semibold text-[var(--is-text)]">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="min-h-11 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg)] px-4 text-sm"
        />
      </div>

      <label className="flex items-center gap-3 text-sm text-[var(--is-text)]">
        <input type="checkbox" name="rememberMe" className="size-4" />
        Recordarme en este dispositivo
      </label>

      <SubmitButton />

      <p className="text-center text-sm leading-relaxed text-[var(--is-muted)]">
        <Link
          href="/recuperar"
          className="font-medium text-[var(--is-accent)] underline-offset-2 hover:underline"
        >
          Olvidé mi contraseña
        </Link>
      </p>

      <p className="text-center text-sm leading-relaxed text-[var(--is-muted)]">
        Identidad DNX Suite (cookie <code className="text-xs">dnx_session</code>).
        Si no tenés rol Info Spot, pedile una invitación al Director.
      </p>
    </form>
  );
}
