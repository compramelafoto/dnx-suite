import { DNX_AUTH_CTA } from "../types";

export function DnxAuthLinks({
  variant,
  loginHref = "/login",
  registerHref = "/crear-cuenta",
  forgotHref = "/recuperar",
  invitationHref,
  invitationLabel,
  showRegister,
  showForgotInAux,
  privacyUrl,
  termsUrl,
}: {
  variant: "aux-forgot" | "create-account" | "have-account" | "legal" | "help";
  loginHref?: string;
  registerHref?: string;
  forgotHref?: string;
  invitationHref?: string;
  invitationLabel?: string;
  showRegister?: boolean;
  showForgotInAux?: boolean;
  privacyUrl?: string;
  termsUrl?: string;
}) {
  if (variant === "aux-forgot" && showForgotInAux !== false) {
    return (
      <div
        data-dnx-auth-slot="aux-row"
        style={{
          display: "flex",
          justifyContent: "flex-end",
          width: "100%",
        }}
      >
        <a
          href={forgotHref}
          style={{
            fontSize: "0.875rem",
            color: "var(--auth-primary)",
            fontFamily: "var(--auth-font)",
          }}
        >
          {DNX_AUTH_CTA.forgotLink}
        </a>
      </div>
    );
  }

  if (variant === "create-account" && showRegister) {
    return (
      <p
        data-dnx-auth-slot="create-account"
        style={{
          margin: 0,
          textAlign: "center",
          fontSize: "0.875rem",
          color: "var(--auth-text-secondary)",
          fontFamily: "var(--auth-font)",
        }}
      >
        ¿No tenés cuenta?{" "}
        <a href={registerHref} style={{ color: "var(--auth-primary)" }}>
          {DNX_AUTH_CTA.createAccount}
        </a>
      </p>
    );
  }

  if (variant === "have-account") {
    return (
      <p
        data-dnx-auth-slot="have-account"
        style={{
          margin: 0,
          textAlign: "center",
          fontSize: "0.875rem",
          color: "var(--auth-text-secondary)",
          fontFamily: "var(--auth-font)",
        }}
      >
        {DNX_AUTH_CTA.haveAccount}{" "}
        <a href={loginHref} style={{ color: "var(--auth-primary)" }}>
          {DNX_AUTH_CTA.login}
        </a>
      </p>
    );
  }

  if (variant === "help") {
    return (
      <p
        data-dnx-auth-slot="help"
        style={{
          margin: 0,
          textAlign: "center",
          fontSize: "0.8125rem",
          color: "var(--auth-text-secondary)",
          fontFamily: "var(--auth-font)",
          lineHeight: 1.55,
        }}
      >
        {invitationHref ? (
          <>
            <a href={invitationHref} style={{ color: "var(--auth-primary)" }}>
              {invitationLabel ?? DNX_AUTH_CTA.invitationHelp}
            </a>
            {" · "}
          </>
        ) : null}
        <a href="/" style={{ color: "var(--auth-text-secondary)" }}>
          Volver al inicio
        </a>
      </p>
    );
  }

  if (variant === "legal" && (privacyUrl || termsUrl)) {
    return (
      <p
        data-dnx-auth-slot="legal"
        style={{
          margin: 0,
          textAlign: "center",
          fontSize: "0.75rem",
          color: "var(--auth-text-secondary)",
          fontFamily: "var(--auth-font)",
          lineHeight: 1.55,
        }}
      >
        {termsUrl ? (
          <a href={termsUrl} style={{ color: "inherit" }}>
            Términos
          </a>
        ) : null}
        {termsUrl && privacyUrl ? " · " : null}
        {privacyUrl ? (
          <a href={privacyUrl} style={{ color: "inherit" }}>
            Privacidad
          </a>
        ) : null}
      </p>
    );
  }

  return null;
}
