"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { judgeLoginAction, type JudgeLoginFormState } from "../../actions/judges";
import { FormField, inputAuth } from "../../components/ui/form";

const initialState: JudgeLoginFormState = { error: null };

function JudgeSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="fr-btn fr-btn-primary w-full py-4 text-base font-semibold"
      data-testid="judge-login-submit"
    >
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

export function JudgeLoginForm() {
  const [state, formAction] = useActionState(judgeLoginAction, initialState);

  return (
    <form data-testid="judge-login-form" action={formAction} method="post" className="w-full space-y-0">
      <FormField
        id="judge-login-email"
        label="Email"
        required
        layout="auth"
        microcopy="El mismo correo con el que te invitaron."
      >
        <input
          id="judge-login-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="tu@email.com"
          className={inputAuth}
        />
      </FormField>
      <FormField id="judge-login-password" label="Contraseña" required layout="auth" className="!pb-8 md:!pb-10">
        <input
          id="judge-login-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
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
        <JudgeSubmitButton />
      </div>
    </form>
  );
}
