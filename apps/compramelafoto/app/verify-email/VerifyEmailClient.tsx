"use client";

import "@repo/auth-ui/tokens.css";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DnxAuthShell,
  DnxAuthHeader,
  DnxVerificationState,
  compramelafotoAuthBrand,
} from "@repo/auth-ui";
import { DNX_AUTH_MESSAGES } from "@repo/auth/messages";

export default function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("Verificando tu email…");

  useEffect(() => {
    const token = searchParams?.get("token");
    if (!token) {
      setStatus("error");
      setMessage(DNX_AUTH_MESSAGES.verifyInvalidToken);
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || DNX_AUTH_MESSAGES.verifyInvalidToken);
        }
        setStatus("success");
        setMessage(DNX_AUTH_MESSAGES.verifySuccess);
        setTimeout(() => {
          router.push("/login?emailVerified=true");
        }, 2500);
      } catch (err: unknown) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : DNX_AUTH_MESSAGES.verifyInvalidToken);
      }
    };

    void verify();
  }, [router, searchParams]);

  return (
    <DnxAuthShell brand={compramelafotoAuthBrand}>
      <DnxAuthHeader
        logo={compramelafotoAuthBrand.logo}
        title="Verificación de email"
        description="Validamos tu email para activar tu Cuenta DNX."
      />
      <DnxVerificationState status={status} message={message} loginHref="/login" />
    </DnxAuthShell>
  );
}
