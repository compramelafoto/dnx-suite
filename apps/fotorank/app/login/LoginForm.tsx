"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginFormState } from "./actions";
import { FormField, inputAuth } from "../components/ui/form";

const initialState: LoginFormState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="fr-btn fr-btn-primary w-full py-4 text-base font-semibold">
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form data-testid="fotorank-login-form" action={formAction} className="w-full space-y-0">
      <FormField id="email" label="Email" required layout="auth">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@email.com"
          className={inputAuth}
        />
      </FormField>

      <FormField id="password" label="Contraseña" required layout="auth" className="!pb-8 md:!pb-10">
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputAuth}
        />
      </FormField>

      {state.error ? (
        <div
          className="rounded-xl border border-red-500/35 bg-red-500/10 px-5 py-4 text-center text-sm leading-relaxed text-red-200 md:text-base"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}

      <div className="mt-10 md:mt-12">
        <SubmitButton />
      </div>
    </form>
  );
}
