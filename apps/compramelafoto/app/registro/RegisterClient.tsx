"use client";

import "@repo/auth-ui/tokens.css";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DnxRegisterPanel, compramelafotoAuthBrand } from "@repo/auth-ui";
import { DNX_AUTH_MESSAGES } from "@repo/auth/messages";
import { sanitizeInternalRedirect } from "@/lib/auth/post-login-destination";

export default function RegisterClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  const redirectParam = searchParams?.get("redirect") || "";
  const safeRedirect = sanitizeInternalRedirect(redirectParam);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading("submitting");

    const fd = new FormData(e.currentTarget);
    const firstName = String(fd.get("firstName") ?? "").trim();
    const lastName = String(fd.get("lastName") ?? "").trim();
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    const passwordConfirm = String(fd.get("passwordConfirm") ?? "");
    const name = [firstName, lastName].filter(Boolean).join(" ").trim();

    if (!name || !email || !password) {
      setError("Completá nombre, email y contraseña.");
      setLoading("idle");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Las contraseñas no coinciden.");
      setLoading("idle");
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (String(data?.error || "").toLowerCase().includes("existe")) {
          throw new Error(DNX_AUTH_MESSAGES.registerExists);
        }
        throw new Error(data?.error || DNX_AUTH_MESSAGES.genericError);
      }

      const loginQs = new URLSearchParams();
      loginQs.set("registered", "1");
      if (safeRedirect) loginQs.set("redirect", safeRedirect);
      router.push(`/login?${loginQs.toString()}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : DNX_AUTH_MESSAGES.genericError);
      setLoading("idle");
    }
  }

  const googleHref = safeRedirect
    ? `/api/auth/google?role=AUTO&redirect=${encodeURIComponent(safeRedirect)}`
    : "/api/auth/google?role=AUTO";
  const loginHref = safeRedirect
    ? `/login?redirect=${encodeURIComponent(safeRedirect)}`
    : "/login";

  return (
    <DnxRegisterPanel
      brand={compramelafotoAuthBrand}
      onSubmit={handleSubmit}
      googleHref={googleHref}
      error={error}
      loading={loading}
      loginHref={loginHref}
    />
  );
}
