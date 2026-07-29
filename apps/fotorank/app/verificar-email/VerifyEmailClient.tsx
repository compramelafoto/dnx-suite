"use client";

import "@repo/auth-ui/tokens.css";
import {
  DnxAuthShell,
  DnxAuthHeader,
  DnxVerificationState,
  fotorankAuthBrand,
} from "@repo/auth-ui";

export function VerifyEmailClient({
  status,
  message,
}: {
  status: "success" | "error";
  message: string;
}) {
  return (
    <DnxAuthShell brand={fotorankAuthBrand}>
      <DnxAuthHeader
        logo={fotorankAuthBrand.logo}
        title="Verificación de email"
        description="Validamos tu email para activar tu Cuenta DNX."
      />
      <DnxVerificationState status={status} message={message} loginHref="/login" />
    </DnxAuthShell>
  );
}
