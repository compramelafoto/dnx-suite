"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { FormField, inputAuth } from "../components/ui/form";
import {
  registerFotorankAccountAction,
  type FotorankRegisterFormState,
} from "./actions";

const initialState: FotorankRegisterFormState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="fr-btn fr-btn-primary w-full py-4 text-base font-semibold"
    >
      {pending ? "Creando…" : "Crear cuenta DNX"}
    </button>
  );
}

export function RegisterForm({ nextPath }: { nextPath?: string | null }) {
  const [state, formAction] = useActionState(registerFotorankAccountAction, initialState);

  return (
    <form action={formAction} className="w-full space-y-0">
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <FormField id="firstName" label="Nombre" required layout="auth">
        <input
          id="firstName"
          name="firstName"
          required
          autoComplete="given-name"
          className={inputAuth}
        />
      </FormField>
      <FormField id="lastName" label="Apellido" required layout="auth">
        <input
          id="lastName"
          name="lastName"
          required
          autoComplete="family-name"
          className={inputAuth}
        />
      </FormField>
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
      <FormField id="password" label="Contraseña" required layout="auth">
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
      <label className="mb-6 flex items-start gap-3 text-left text-sm text-fr-muted">
        <input type="checkbox" name="acceptedTerms" required className="mt-1" />
        <span>Acepto los términos de la Cuenta DNX.</span>
      </label>
      <label className="mb-8 flex items-start gap-3 text-left text-sm text-fr-muted">
        <input type="checkbox" name="acceptedPrivacy" required className="mt-1" />
        <span>Acepto la política de privacidad.</span>
      </label>
      {state.error ? (
        <div
          className="mb-8 rounded-xl border border-red-500/35 bg-red-500/10 px-5 py-4 text-center text-sm text-red-200"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}
      <SubmitButton />
      <p className="mt-8 text-center text-sm text-fr-muted">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="text-gold hover:underline">
          Iniciar sesión
        </Link>
      </p>
      <p className="mt-4 text-center text-xs leading-relaxed text-fr-muted">
        Crear una Cuenta DNX no te inscribe a un concurso ni otorga rol de organizador o jurado.
      </p>
    </form>
  );
}
