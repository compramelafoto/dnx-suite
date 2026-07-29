"use client";

import "@repo/auth-ui/tokens.css";
import { useState, type FormEvent } from "react";
import { DnxForgotPanel, compramelafotoAuthBrand } from "@repo/auth-ui";
import { DNX_AUTH_MESSAGES } from "@repo/auth/messages";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState<"idle" | "sending-email">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading("sending-email");

    const email = String(new FormData(e.currentTarget).get("email") ?? "");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || DNX_AUTH_MESSAGES.genericError);
      }
      setNotice(data.message || DNX_AUTH_MESSAGES.resetNeutral);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : DNX_AUTH_MESSAGES.genericError);
    } finally {
      setLoading("idle");
    }
  }

  return (
    <DnxForgotPanel
      brand={compramelafotoAuthBrand}
      onSubmit={handleSubmit}
      error={error}
      notice={notice}
      loading={loading}
      loginHref="/login"
    />
  );
}
