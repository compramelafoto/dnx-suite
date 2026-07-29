"use client";

import "@repo/auth-ui/tokens.css";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { DnxLoginPanel, compramelafotoAuthBrand } from "@repo/auth-ui";
import { DNX_AUTH_MESSAGES } from "@repo/auth/messages";
import SessionTransitionOverlay from "@/components/layout/SessionTransitionOverlay";
import {
  getPostLoginDestination,
  sanitizeInternalRedirect,
} from "@/lib/auth/post-login-destination";

export default function LoginClient() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | undefined>();
  const [showWelcome, setShowWelcome] = useState(false);
  const pendingRedirectRef = useRef<{
    role: string;
    safeRedirect: string;
    user: { id: number | string; labId?: number | null };
  } | null>(null);

  const redirectParam = searchParams?.get("redirect") || "";
  const safeRedirect = sanitizeInternalRedirect(redirectParam);

  useEffect(() => {
    const passwordReset = searchParams?.get("passwordReset");
    const logout = searchParams?.get("logout");
    if (passwordReset === "true") {
      setSuccessNotice(DNX_AUTH_MESSAGES.passwordChanged);
    } else if (logout === "success") {
      setSuccessNotice("Sesión cerrada correctamente. Podés iniciar sesión nuevamente.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!showWelcome || !pendingRedirectRef.current) return;
    const { role, safeRedirect: redirect, user } = pendingRedirectRef.current;
    const t = setTimeout(() => {
      if (role === "PHOTOGRAPHER") {
        sessionStorage.setItem("photographer", JSON.stringify(user));
        sessionStorage.setItem("photographerId", user.id.toString());
      } else if (role === "LAB" || role === "LAB_PHOTOGRAPHER") {
        sessionStorage.setItem("lab", JSON.stringify(user));
        if (user?.labId != null) sessionStorage.setItem("labId", user.labId.toString());
      } else if (role === "CUSTOMER") {
        sessionStorage.setItem("client", JSON.stringify(user));
        sessionStorage.setItem("clientId", user.id.toString());
      } else if (role === "ORGANIZER") {
        sessionStorage.setItem("organizer", JSON.stringify(user));
        sessionStorage.setItem("organizerId", user.id.toString());
      } else if (role === "SCHOOL_ORGANIZER") {
        sessionStorage.setItem("schoolOrganizer", JSON.stringify(user));
        sessionStorage.setItem("schoolOrganizerId", user.id.toString());
      }

      const target = getPostLoginDestination(role, redirect);
      pendingRedirectRef.current = null;
      setShowWelcome(false);
      window.location.href = target;
    }, 1200);
    return () => clearTimeout(t);
  }, [showWelcome]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading("submitting");

    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          "El preview está protegido por Vercel. Iniciá sesión en Vercel o usá un bypass.",
        );
      }

      const data = await res.json();
      if (!res.ok) {
        if (String(data?.error || "").toLowerCase().includes("sin contraseña")) {
          throw new Error(DNX_AUTH_MESSAGES.noPasswordUseGoogle);
        }
        throw new Error(data?.error || DNX_AUTH_MESSAGES.loginInvalid);
      }

      const role = data.user?.role;
      if (!role) {
        throw new Error(DNX_AUTH_MESSAGES.genericError);
      }
      if ((role === "LAB" || role === "LAB_PHOTOGRAPHER") && !data.user?.labId) {
        throw new Error("No se pudo obtener la información del laboratorio");
      }

      pendingRedirectRef.current = { role, safeRedirect, user: data.user };
      setLoading("idle");
      setShowWelcome(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : DNX_AUTH_MESSAGES.genericError;
      setError(message);
      setLoading("idle");
    }
  }

  const googleHref = safeRedirect
    ? `/api/auth/google?role=AUTO&redirect=${encodeURIComponent(safeRedirect)}`
    : "/api/auth/google?role=AUTO";
  const registerHref = safeRedirect
    ? `/registro?redirect=${encodeURIComponent(safeRedirect)}`
    : "/registro";

  return (
    <>
      {showWelcome ? (
        <SessionTransitionOverlay message="Bienvenido" variant="login" />
      ) : null}
      <DnxLoginPanel
        brand={compramelafotoAuthBrand}
        onSubmit={handleSubmit}
        googleHref={googleHref}
        error={error}
        loading={loading}
        registerHref={registerHref}
        forgotHref="/forgot-password"
        loginHref="/login"
        contextualNotice={successNotice}
      />
    </>
  );
}
