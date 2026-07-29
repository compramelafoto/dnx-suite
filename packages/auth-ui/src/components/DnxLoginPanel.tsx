"use client";

import type { FormEventHandler, ReactNode } from "react";
import type { DnxAuthBrandConfig, DnxAuthLoadingState } from "../types";
import { DNX_AUTH_CTA } from "../types";
import { DnxAuthShell } from "./DnxAuthShell";
import { DnxAuthHeader } from "./DnxAuthHeader";
import { DnxEmailField } from "./DnxEmailField";
import { DnxPasswordField } from "./DnxPasswordField";
import { DnxAuthLinks } from "./DnxAuthLinks";
import { DnxPrimaryAuthButton } from "./DnxPrimaryAuthButton";
import { DnxAuthError } from "./DnxAuthError";
import { DnxAuthDivider } from "./DnxAuthDivider";
import { DnxGoogleButton } from "./DnxGoogleButton";

export type DnxLoginPanelProps = {
  brand: DnxAuthBrandConfig;
  /** Form action URL o handler — sin Prisma */
  formAction?: string | ((formData: FormData) => void | Promise<void>);
  onSubmit?: FormEventHandler<HTMLFormElement>;
  googleHref?: string;
  error?: string | null;
  loading?: DnxAuthLoadingState;
  nextPath?: string;
  hiddenFields?: ReactNode;
  loginHref?: string;
  registerHref?: string;
  forgotHref?: string;
  invitationHref?: string;
  contextualNotice?: string;
};

/**
 * Login canónico — orden fijo vía data-dnx-auth-slot.
 * Google siempre después del CTA + divider.
 */
export function DnxLoginPanel({
  brand,
  formAction,
  onSubmit,
  googleHref = "/api/auth/google",
  error,
  loading = "idle",
  nextPath,
  hiddenFields,
  loginHref = "/login",
  registerHref = "/crear-cuenta",
  forgotHref = "/recuperar",
  invitationHref,
  contextualNotice,
}: DnxLoginPanelProps) {
  const copy = brand.contextualCopy;
  const submitting = loading === "submitting";
  const googleLoading = loading === "redirecting-google";

  return (
    <DnxAuthShell
      brand={brand}
      footer={
        <DnxAuthLinks
          variant="legal"
          privacyUrl={brand.privacyUrl}
          termsUrl={brand.termsUrl}
        />
      }
    >
      <DnxAuthHeader
        logo={brand.logo}
        title={copy?.loginTitle ?? DNX_AUTH_CTA.login}
        description={copy?.loginDescription}
        contextualNotice={contextualNotice ?? copy?.contextualNotice}
      />

      <form
        action={formAction as never}
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1.5rem", width: "100%" }}
        noValidate={false}
      >
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
        {hiddenFields}
        {brand.allowEmailLogin ? (
          <>
            <DnxEmailField disabled={submitting} />
            <DnxPasswordField disabled={submitting} autoComplete="current-password" />
            {brand.allowPasswordReset ? (
              <DnxAuthLinks variant="aux-forgot" forgotHref={forgotHref} showForgotInAux />
            ) : null}
            <DnxPrimaryAuthButton loading={submitting} loadingLabel="Iniciando sesión…">
              {copy?.loginCta ?? DNX_AUTH_CTA.login}
            </DnxPrimaryAuthButton>
          </>
        ) : null}
      </form>

      <DnxAuthError message={error} />

      {brand.allowGoogle ? (
        <>
          <DnxAuthDivider />
          <DnxGoogleButton
            href={
              nextPath
                ? `${googleHref}${googleHref.includes("?") ? "&" : "?"}next=${encodeURIComponent(nextPath)}`
                : googleHref
            }
            loading={googleLoading}
            emphasis={brand.googleVisualEmphasis ?? "secondary"}
            label={copy?.googleCta ?? DNX_AUTH_CTA.google}
          />
        </>
      ) : null}

      <DnxAuthLinks
        variant="create-account"
        registerHref={
          nextPath ? `${registerHref}?next=${encodeURIComponent(nextPath)}` : registerHref
        }
        showRegister={brand.allowEmailRegistration && !brand.invitationOnly}
      />

      <DnxAuthLinks
        variant="help"
        invitationHref={brand.invitationOnly ? invitationHref : undefined}
        loginHref={loginHref}
      />
    </DnxAuthShell>
  );
}
