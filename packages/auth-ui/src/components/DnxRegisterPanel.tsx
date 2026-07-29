"use client";

import type { FormEventHandler, ReactNode } from "react";
import type { DnxAuthBrandConfig, DnxAuthLoadingState } from "../types";
import { DNX_AUTH_CTA } from "../types";
import { controlStyle, fieldStack, labelStyle } from "../styles";
import { DnxAuthShell } from "./DnxAuthShell";
import { DnxAuthHeader } from "./DnxAuthHeader";
import { DnxEmailField } from "./DnxEmailField";
import { DnxPasswordField } from "./DnxPasswordField";
import { DnxPasswordRequirements } from "./DnxPasswordRequirements";
import { DnxPrimaryAuthButton } from "./DnxPrimaryAuthButton";
import { DnxAuthError } from "./DnxAuthError";
import { DnxAuthDivider } from "./DnxAuthDivider";
import { DnxGoogleButton } from "./DnxGoogleButton";
import { DnxAuthLinks } from "./DnxAuthLinks";

export type DnxRegisterPanelProps = {
  brand: DnxAuthBrandConfig;
  formAction?: string | ((formData: FormData) => void | Promise<void>);
  onSubmit?: FormEventHandler<HTMLFormElement>;
  googleHref?: string;
  error?: string | null;
  loading?: DnxAuthLoadingState;
  nextPath?: string;
  hiddenFields?: ReactNode;
  loginHref?: string;
  termsAcceptedName?: string;
};

export function DnxRegisterPanel({
  brand,
  formAction,
  onSubmit,
  googleHref = "/api/auth/google",
  error,
  loading = "idle",
  nextPath,
  hiddenFields,
  loginHref = "/login",
  termsAcceptedName = "acceptTerms",
}: DnxRegisterPanelProps) {
  const copy = brand.contextualCopy;
  const submitting = loading === "submitting";

  if (brand.invitationOnly || !brand.allowEmailRegistration) {
    return (
      <DnxAuthShell brand={brand}>
        <DnxAuthHeader
          logo={brand.logo}
          title="Acceso por invitación"
          description="Esta plataforma no ofrece registro público. Usá una invitación o iniciá sesión."
        />
        <DnxAuthLinks variant="have-account" loginHref={loginHref} />
      </DnxAuthShell>
    );
  }

  return (
    <DnxAuthShell
      brand={brand}
      footer={
        <DnxAuthLinks variant="legal" privacyUrl={brand.privacyUrl} termsUrl={brand.termsUrl} />
      }
    >
      <DnxAuthHeader
        logo={brand.logo}
        title={copy?.registerTitle ?? DNX_AUTH_CTA.register}
        description={copy?.registerDescription}
      />

      <form
        action={formAction as never}
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1.5rem", width: "100%" }}
      >
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
        {hiddenFields}
        <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "1fr 1fr" }}>
          <div data-dnx-auth-slot="firstName" style={fieldStack}>
            <label htmlFor="firstName" style={labelStyle}>
              Nombre
            </label>
            <input
              id="firstName"
              name="firstName"
              autoComplete="given-name"
              required
              disabled={submitting}
              style={controlStyle}
            />
          </div>
          <div data-dnx-auth-slot="lastName" style={fieldStack}>
            <label htmlFor="lastName" style={labelStyle}>
              Apellido
            </label>
            <input
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              required
              disabled={submitting}
              style={controlStyle}
            />
          </div>
        </div>
        <DnxEmailField disabled={submitting} autoComplete="email" />
        <DnxPasswordField
          name="password"
          label="Contraseña"
          autoComplete="new-password"
          disabled={submitting}
        />
        <DnxPasswordField
          id="passwordConfirm"
          name="passwordConfirm"
          label="Repetir contraseña"
          autoComplete="new-password"
          disabled={submitting}
        />
        <DnxPasswordRequirements />
        <label
          data-dnx-auth-slot="consents"
          style={{
            display: "flex",
            gap: "0.75rem",
            alignItems: "flex-start",
            fontSize: "0.875rem",
            color: "var(--auth-text-secondary)",
            fontFamily: "var(--auth-font)",
            lineHeight: 1.5,
          }}
        >
          <input type="checkbox" name={termsAcceptedName} value="1" required disabled={submitting} />
          <span>
            Acepto los{" "}
            <a href={brand.termsUrl} style={{ color: "var(--auth-primary)" }}>
              términos
            </a>{" "}
            y la{" "}
            <a href={brand.privacyUrl} style={{ color: "var(--auth-primary)" }}>
              privacidad
            </a>
            .
          </span>
        </label>
        <DnxPrimaryAuthButton loading={submitting} loadingLabel="Creando cuenta…">
          {copy?.createAccountCta ?? DNX_AUTH_CTA.register}
        </DnxPrimaryAuthButton>
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
            emphasis={brand.googleVisualEmphasis ?? "secondary"}
          />
        </>
      ) : null}

      <DnxAuthLinks variant="have-account" loginHref={loginHref} />
    </DnxAuthShell>
  );
}
