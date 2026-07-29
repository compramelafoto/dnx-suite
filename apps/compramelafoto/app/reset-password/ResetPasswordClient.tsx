"use client";

import "@repo/auth-ui/tokens.css";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DnxResetPanel, compramelafotoAuthBrand } from "@repo/auth-ui";
import { DNX_AUTH_MESSAGES } from "@repo/auth/messages";

export default function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState<"idle" | "resetting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const tokenParam = searchParams?.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError(DNX_AUTH_MESSAGES.resetInvalidToken);
    }
  }, [searchParams]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const passwordConfirm = String(fd.get("passwordConfirm") ?? "");
    const formToken = String(fd.get("token") ?? token);

    if (!formToken) {
      setError(DNX_AUTH_MESSAGES.resetInvalidToken);
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading("resetting");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: formToken, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || DNX_AUTH_MESSAGES.resetInvalidToken);
      }
      setNotice(DNX_AUTH_MESSAGES.passwordChanged);
      setTimeout(() => {
        router.push("/login?passwordReset=true");
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : DNX_AUTH_MESSAGES.genericError);
    } finally {
      setLoading("idle");
    }
  }

  if (!token && !error) {
    return (
      <DnxResetPanel
        brand={compramelafotoAuthBrand}
        token=""
        loading="submitting"
        loginHref="/login"
      />
    );
  }

  return (
    <DnxResetPanel
      brand={compramelafotoAuthBrand}
      token={token}
      onSubmit={handleSubmit}
      error={error}
      notice={notice}
      loading={loading}
      loginHref="/login"
    />
  );
}
