"use client";

import "@repo/auth-ui/tokens.css";
import { useActionState } from "react";
import { DnxLoginPanel, fotofficeAuthBrand } from "@repo/auth-ui";
import { fotofficeLoginAction, type LoginFormState } from "./actions";

const initial: LoginFormState = { error: null };

export function LoginView({
  initialAdminMode,
  dbUnavailable,
  errorMessage,
  nextPath,
}: {
  initialAdminMode: boolean;
  dbUnavailable?: boolean;
  errorMessage?: string | null;
  nextPath?: string | null;
}) {
  const [state, formAction, pending] = useActionState(fotofficeLoginAction, initial);
  const error = state.error ?? errorMessage ?? null;

  const contextualNotice = initialAdminMode
    ? "Modo administración: usá tu Cuenta DNX con permisos de plataforma."
    : dbUnavailable
      ? "Base de datos no disponible. Revisá DATABASE_URL."
      : undefined;

  return (
    <main className="flex min-h-screen w-full items-center justify-center px-4 py-12 bg-[var(--fo-bg)]">
      <DnxLoginPanel
        brand={fotofficeAuthBrand}
        formAction={formAction}
        nextPath={nextPath ?? undefined}
        error={error}
        loading={pending ? "submitting" : "idle"}
        googleHref="/api/auth/google"
        forgotHref="/recuperar"
        loginHref="/login"
        contextualNotice={contextualNotice}
      />
    </main>
  );
}
