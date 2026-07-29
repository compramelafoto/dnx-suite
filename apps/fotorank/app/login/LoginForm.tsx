"use client";

import "@repo/auth-ui/tokens.css";
import { useActionState } from "react";
import { DnxLoginPanel, fotorankAuthBrand } from "@repo/auth-ui";
import { loginAction, type LoginFormState } from "./actions";

const initialState: LoginFormState = { error: null };

export function LoginForm({
  oauthError,
  nextPath,
  contextualNotice,
}: {
  oauthError?: string | null;
  nextPath?: string | null;
  contextualNotice?: string;
}) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const error = state.error ?? oauthError ?? null;

  return (
    <DnxLoginPanel
      brand={fotorankAuthBrand}
      formAction={formAction}
      nextPath={nextPath ?? undefined}
      error={error}
      loading={pending ? "submitting" : "idle"}
      googleHref="/api/auth/google"
      registerHref="/crear-cuenta"
      forgotHref="/recuperar"
      loginHref="/login"
      invitationHref="/jurado/login"
      contextualNotice={contextualNotice}
    />
  );
}
