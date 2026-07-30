"use client";

import "@repo/auth-ui/tokens.css";
import { DnxLoginPanel, infospotAuthBrand } from "@repo/auth-ui";
import { buildGoogleOAuthStartHref } from "@/lib/google-oauth-start";

export function LoginForm({
  next,
  deniedMessage,
  oauthError,
}: {
  next: string;
  deniedMessage?: string | null;
  oauthError?: string | null;
}) {
  const error = oauthError?.trim() || null;
  const googleHref = buildGoogleOAuthStartHref({ next });

  return (
    <DnxLoginPanel
      brand={infospotAuthBrand}
      formAction="/api/auth/login"
      nextPath={next}
      error={error}
      googleHref={googleHref}
      forgotHref="/recuperar"
      loginHref="/ingresar"
      invitationHref="/invitar"
      contextualNotice={deniedMessage ?? undefined}
    />
  );
}
