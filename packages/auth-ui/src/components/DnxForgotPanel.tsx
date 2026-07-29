"use client";

import type { FormEventHandler } from "react";
import type { DnxAuthBrandConfig, DnxAuthLoadingState } from "../types";
import { DNX_AUTH_CTA } from "../types";
import { DnxAuthShell } from "./DnxAuthShell";
import { DnxAuthHeader } from "./DnxAuthHeader";
import { DnxEmailField } from "./DnxEmailField";
import { DnxPrimaryAuthButton } from "./DnxPrimaryAuthButton";
import { DnxAuthError } from "./DnxAuthError";
import { DnxAuthNotice } from "./DnxAuthNotice";
import { DnxAuthLinks } from "./DnxAuthLinks";

export function DnxForgotPanel({
  brand,
  formAction,
  onSubmit,
  error,
  notice,
  loading = "idle",
  loginHref = "/login",
}: {
  brand: DnxAuthBrandConfig;
  formAction?: string | ((formData: FormData) => void | Promise<void>);
  onSubmit?: FormEventHandler<HTMLFormElement>;
  error?: string | null;
  notice?: string | null;
  loading?: DnxAuthLoadingState;
  loginHref?: string;
}) {
  const copy = brand.contextualCopy;
  const sending = loading === "sending-email" || loading === "submitting";

  return (
    <DnxAuthShell brand={brand}>
      <DnxAuthHeader
        logo={brand.logo}
        title={copy?.forgotTitle ?? "Recuperar contraseña"}
        description={
          copy?.forgotDescription ??
          "Te enviaremos un enlace si existe una cuenta asociada a ese email."
        }
      />
      <form
        action={formAction as never}
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
      >
        <DnxEmailField disabled={sending} />
        <DnxPrimaryAuthButton loading={sending} loadingLabel="Enviando…">
          {DNX_AUTH_CTA.forgot}
        </DnxPrimaryAuthButton>
      </form>
      <DnxAuthError message={error} />
      <DnxAuthNotice tone="info" message={notice} />
      <DnxAuthLinks variant="have-account" loginHref={loginHref} />
    </DnxAuthShell>
  );
}
