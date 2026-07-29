"use client";

import type { FormEventHandler } from "react";
import type { DnxAuthBrandConfig, DnxAuthLoadingState } from "../types";
import { DNX_AUTH_CTA } from "../types";
import { DnxAuthShell } from "./DnxAuthShell";
import { DnxAuthHeader } from "./DnxAuthHeader";
import { DnxPasswordField } from "./DnxPasswordField";
import { DnxPasswordRequirements } from "./DnxPasswordRequirements";
import { DnxPrimaryAuthButton } from "./DnxPrimaryAuthButton";
import { DnxAuthError } from "./DnxAuthError";
import { DnxAuthNotice } from "./DnxAuthNotice";
import { DnxAuthLinks } from "./DnxAuthLinks";

export function DnxResetPanel({
  brand,
  formAction,
  onSubmit,
  token,
  error,
  notice,
  loading = "idle",
  loginHref = "/login",
}: {
  brand: DnxAuthBrandConfig;
  formAction?: string | ((formData: FormData) => void | Promise<void>);
  onSubmit?: FormEventHandler<HTMLFormElement>;
  token: string;
  error?: string | null;
  notice?: string | null;
  loading?: DnxAuthLoadingState;
  loginHref?: string;
}) {
  const resetting = loading === "resetting" || loading === "submitting";
  const copy = brand.contextualCopy;

  return (
    <DnxAuthShell brand={brand}>
      <DnxAuthHeader
        logo={brand.logo}
        title={copy?.resetTitle ?? "Nueva contraseña"}
        description="Definí una contraseña para tu Cuenta DNX. Servirá en todas las plataformas habilitadas."
      />
      <form
        action={formAction as never}
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
      >
        <input type="hidden" name="token" value={token} />
        <DnxPasswordField
          name="password"
          label="Nueva contraseña"
          autoComplete="new-password"
          disabled={resetting}
        />
        <DnxPasswordField
          id="passwordConfirm"
          name="passwordConfirm"
          label="Repetir contraseña"
          autoComplete="new-password"
          disabled={resetting}
        />
        <DnxPasswordRequirements />
        <DnxPrimaryAuthButton loading={resetting} loadingLabel="Guardando…">
          {DNX_AUTH_CTA.reset}
        </DnxPrimaryAuthButton>
      </form>
      <DnxAuthError message={error} />
      <DnxAuthNotice tone="success" message={notice} />
      <DnxAuthLinks variant="have-account" loginHref={loginHref} />
    </DnxAuthShell>
  );
}
