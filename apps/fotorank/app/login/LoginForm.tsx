"use client";

import Link from "next/link";
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

export function LoginForm({
  oauthError,
  nextPath,
}: {
  oauthError?: string | null;
  nextPath?: string | null;
}) {
  const [state, formAction] = useActionState(loginAction, initialState);
  const bannerError = state.error ?? oauthError ?? null;

  return (
    <>
      <form data-testid="fotorank-login-form" action={formAction} className="w-full space-y-0">
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
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

        <FormField id="password" label="Contraseña" required layout="auth" className="!pb-4 md:!pb-6">
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={inputAuth}
          />
        </FormField>

        <p className="mb-8 text-center text-sm">
          <Link href="/recuperar" className="text-gold hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </p>

        {bannerError ? (
          <div
            className="rounded-xl border border-red-500/35 bg-red-500/10 px-5 py-4 text-center text-sm leading-relaxed text-red-200 md:text-base"
            role="alert"
          >
            {bannerError}
          </div>
        ) : null}

        <div className="mt-10 md:mt-12">
          <SubmitButton />
        </div>
      </form>

      <p className="mt-8 text-center text-sm text-fr-muted">
        ¿No tenés cuenta?{" "}
        <Link
          href={nextPath ? `/crear-cuenta?next=${encodeURIComponent(nextPath)}` : "/crear-cuenta"}
          className="text-gold hover:underline"
        >
          Crear cuenta con email
        </Link>
      </p>

      <div className="mt-8 w-full border-t border-fr-border pt-8">
        <a
          href="/api/auth/google"
          className="fr-btn fr-btn-secondary flex w-full items-center justify-center gap-2 py-4 text-base font-semibold no-underline"
        >
          Continuar con Google
        </a>
      </div>
    </>
  );
}
