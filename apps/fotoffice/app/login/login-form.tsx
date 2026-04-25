"use client";

import { useActionState, type PointerEvent } from "react";
import { fotofficeLoginAction, type LoginFormState } from "./actions";

const initial: LoginFormState = { error: null };

export function LoginForm({
  onSubmitButtonPointerDown,
}: {
  onSubmitButtonPointerDown?: (e: PointerEvent<HTMLButtonElement>) => void;
} = {}) {
  const [state, action, pending] = useActionState(fotofficeLoginAction, initial);

  return (
    <form action={action} className="space-y-6" noValidate>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="fo-input"
          placeholder="tu@email.com"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="fo-input"
          placeholder="••••••••"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </div>
      {state.error ? (
        <p id="login-error" className="text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        className="fo-btn fo-btn-primary w-full"
        disabled={pending}
        aria-busy={pending}
        onPointerDown={(e) => onSubmitButtonPointerDown?.(e)}
      >
        {pending ? "Entrando…" : "Iniciar sesión"}
      </button>
      <p className="text-center text-[10px] text-[var(--fo-muted-soft)] leading-relaxed">
        Tip: con{" "}
        <kbd className="px-1 py-0.5 rounded border border-[var(--fo-kbd-border)] bg-[var(--fo-kbd-bg)] font-mono shadow-[var(--fo-shadow-xs)]">
          Mayús
        </kbd>{" "}
        + clic en el botón activás el modo administración en esta pantalla.
      </p>
    </form>
  );
}
