"use client";

import "@repo/auth-ui/tokens.css";
import {
  DnxAuthShell,
  DnxAuthHeader,
  DnxVerificationState,
  clickatonAuthBrand,
} from "@repo/auth-ui";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";

export function VerifyEmailClient({
  status,
  message,
}: {
  status: "success" | "error";
  message: string;
}) {
  return (
    <DnxAuthShell brand={clickatonAuthBrand}>
      <DnxAuthHeader
        logo={clickatonAuthBrand.logo}
        title="Verificación de email"
        description="Validamos tu email para activar tu Cuenta DNX."
      />
      <DnxVerificationState
        status={status}
        message={message}
        loginHref={CLICKATON_LOGIN_PATH}
      />
    </DnxAuthShell>
  );
}
