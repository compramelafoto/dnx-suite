"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  cambiarClaveConEnlaceAction,
  type EstadoDeLaNuevaClave,
} from "../../../actions/judgePasswordReset";
import { FormField, inputAuth } from "../../../components/ui/form";
import { PASSWORD_MINIMA } from "../../../lib/fotorank/judges/publicSignupForm";

const INICIAL: EstadoDeLaNuevaClave = { error: null };

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="fr-btn fr-btn-primary w-full py-4 text-base font-semibold"
      data-testid="judge-reset-submit"
    >
      {pending ? "Guardando…" : "Cambiar mi contraseña"}
    </button>
  );
}

export function NuevaClaveForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(cambiarClaveConEnlaceAction, INICIAL);

  return (
    <form action={formAction} className="w-full space-y-0" data-testid="judge-reset-form">
      <input type="hidden" name="token" value={token} />

      <FormField
        id="judge-reset-password"
        label="Contraseña nueva"
        required
        layout="auth"
        microcopy={`Al menos ${PASSWORD_MINIMA} caracteres.`}
        error={state.errores?.password}
      >
        <input
          id="judge-reset-password"
          name="password"
          type="password"
          required
          minLength={PASSWORD_MINIMA}
          autoComplete="new-password"
          placeholder="••••••••"
          className={inputAuth}
        />
      </FormField>

      {/*
        Se pide dos veces porque no se ve lo que se escribe: un error de tipeo
        acá deja a la persona afuera de la única puerta que acaba de arreglar.
      */}
      <FormField
        id="judge-reset-password-confirm"
        label="Repetila"
        required
        layout="auth"
        error={state.errores?.passwordConfirm}
        className="!pb-8 md:!pb-10"
      >
        <input
          id="judge-reset-password-confirm"
          name="passwordConfirm"
          type="password"
          required
          autoComplete="new-password"
          placeholder="••••••••"
          className={inputAuth}
        />
      </FormField>

      {state.error ? (
        <div
          className="rounded-xl border border-red-500/35 bg-red-500/10 px-5 py-4 text-center text-sm leading-relaxed text-red-200"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}

      <div className="mt-10 md:mt-12">
        <Boton />
      </div>
    </form>
  );
}
