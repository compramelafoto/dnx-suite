"use client";

import CuantoCobroLogo from "@/components/cuantocobro/CuantoCobroLogo";
import SessionTransitionOverlay from "@/components/layout/SessionTransitionOverlay";
import CuantoCobroButton from "@/components/cuantocobro/CuantoCobroButton";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import {
  CC_APP_PATH,
  getCuantoCobroRegisterUrl,
  isCuantoCobroRedirectPath,
} from "@/lib/cuantocobro/constants";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const CC_ALLOWED_ROLES = new Set(["PHOTOGRAPHER", "LAB_PHOTOGRAPHER", "ADMIN"]);

export default function CuantoCobroLoginClient() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const pendingRedirectRef = useRef<{ role: string; safeRedirect: string; user: unknown } | null>(null);

  const redirectParam = searchParams?.get("redirect") || "";
  const safeRedirect =
    redirectParam.startsWith("/") && !redirectParam.startsWith("//") ? redirectParam : CC_APP_PATH;

  useEffect(() => {
    const passwordReset = searchParams?.get("passwordReset");
    const logout = searchParams?.get("logout");
    const registered = searchParams?.get("registered");

    if (passwordReset === "true") {
      setSuccess("Tu contraseña fue restablecida correctamente. Ya podés iniciar sesión.");
    } else if (logout === "success") {
      setSuccess("Sesión cerrada correctamente. Podés iniciar sesión nuevamente.");
    } else if (registered === "true") {
      setSuccess("Cuenta creada. Revisá tu email si hace falta verificarla y luego iniciá sesión.");
    }

    const oauthError = searchParams?.get("error");
    if (oauthError) {
      setError(decodeURIComponent(oauthError));
    }
  }, [searchParams]);

  useEffect(() => {
    if (!showWelcome || !pendingRedirectRef.current) return;
    const { role, safeRedirect: redirect, user } = pendingRedirectRef.current;
    const t = setTimeout(() => {
      let target = redirect || CC_APP_PATH;

      if (role === "PHOTOGRAPHER" || role === "LAB_PHOTOGRAPHER") {
        const u = user as { id: number; labId?: number };
        if (role === "PHOTOGRAPHER") {
          sessionStorage.setItem("photographer", JSON.stringify(user));
          sessionStorage.setItem("photographerId", String(u.id));
        } else {
          sessionStorage.setItem("lab", JSON.stringify(user));
          if (u.labId) sessionStorage.setItem("labId", String(u.labId));
        }
      } else if (role === "ADMIN") {
        target = redirect || "/admin";
      }

      pendingRedirectRef.current = null;
      setShowWelcome(false);
      window.location.href = target;
    }, 1200);
    return () => clearTimeout(t);
  }, [showWelcome]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Error en el login");
      }

      const role = data.user?.role;
      if (!role) {
        throw new Error("No se pudo determinar el tipo de usuario");
      }
      if ((role === "LAB" || role === "LAB_PHOTOGRAPHER") && !data.user?.labId) {
        throw new Error("No se pudo obtener la información del laboratorio");
      }
      if (isCuantoCobroRedirectPath(safeRedirect) && !CC_ALLOWED_ROLES.has(role)) {
        throw new Error(
          "Esta cuenta no tiene acceso a ¿Cuánto Cobro?. Iniciá sesión con una cuenta de fotógrafo o creá una nueva.",
        );
      }

      pendingRedirectRef.current = { role, safeRedirect, user: data.user };
      setShowWelcome(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  const googleHref = `/api/auth/google?role=PHOTOGRAPHER&redirect=${encodeURIComponent(safeRedirect)}`;
  const forgotPasswordHref = `/forgot-password?redirect=${encodeURIComponent(`/cuantocobro/login?redirect=${encodeURIComponent(safeRedirect)}`)}`;

  return (
    <>
      {showWelcome ? <SessionTransitionOverlay message="Bienvenido" variant="login" /> : null}

      <section className="cc-login-page" aria-labelledby="cc-login-title">
        <div className="container-custom cc-login-page__inner">
          <div className="cc-login-page__brand">
            <CuantoCobroLogo variant="hero" href="/cuantocobro" className="mx-auto" />
          </div>

          <div className="cc-login-page__intro">
            <h1 id="cc-login-title" className="cc-login-page__title">
              Iniciá sesión
            </h1>
            <p className="cc-login-page__subtitle">
              Usá tu cuenta de ComprameLaFoto para acceder a la herramienta y armar presupuestos rentables.
            </p>
          </div>

          <Card className="cc-login-card ds-form-stack">
            {error ? (
              <div className="ds-info-panel cc-info-panel--warning" role="alert">
                <p className="ds-info-panel__body m-0 text-sm">{error}</p>
              </div>
            ) : null}

            {success ? (
              <div className="ds-info-panel cc-info-panel--accent" role="status">
                <p className="ds-info-panel__body m-0 text-sm">{success}</p>
              </div>
            ) : null}

            <CuantoCobroButton
              type="button"
              variant="secondary"

              className="w-full min-h-[44px] flex items-center justify-center gap-2"
              onClick={() => {
                window.location.href = googleHref;
              }}
              disabled={loading}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continuar con Google
            </CuantoCobroButton>

            <div className="cc-login-card__divider" aria-hidden>
              <span>o con email</span>
            </div>

            <form onSubmit={handleSubmit} className="ds-form-stack">
              <div>
                <label htmlFor="cc-login-email" className="cc-login-card__label">
                  Email
                </label>
                <Input
                  id="cc-login-email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="cc-login-password" className="cc-login-card__label">
                  Contraseña
                </label>
                <div className="relative">
                  <Input
                    id="cc-login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="current-password"
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showPassword}
                    className="cc-login-card__toggle-password"
                    disabled={loading}
                  >
                    {showPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </div>

              <CuantoCobroButton
                type="submit"
                variant="primary"


                className="w-full min-h-[44px]"
                disabled={loading}
              >
                {loading ? "Iniciando sesión…" : "Iniciar sesión"}
              </CuantoCobroButton>

              <p className="text-center m-0">
                <Link href={forgotPasswordHref} className="cc-login-card__link text-sm">
                  ¿Olvidaste tu contraseña?
                </Link>
              </p>
            </form>

            <div className="cc-login-card__footer">
              <p className="m-0 text-sm text-[var(--cc-color-muted)]">
                ¿No tenés cuenta?{" "}
                <Link href={getCuantoCobroRegisterUrl()} className="cc-login-card__link">
                  Registrate como fotógrafo
                </Link>
              </p>
            </div>
          </Card>

          <div className="cc-login-page__back">
            <Link href="/cuantocobro" className="cc-login-card__link text-sm">
              ← Volver a ¿Cuánto Cobro?
            </Link>
            <p className="cc-login-page__clf-note m-0 text-xs text-[var(--cc-color-muted)]">
              Una herramienta de{" "}
              <Link href="/" className="cc-login-card__link">
                ComprameLaFoto
              </Link>
              . Misma cuenta, mismo acceso seguro.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
