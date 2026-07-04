"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import SessionTransitionOverlay from "@/components/layout/SessionTransitionOverlay";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const pendingRedirectRef = useRef<{ role: string; safeRedirect: string; user: any } | null>(null);
  const redirectParam = searchParams?.get("redirect") || "";
  const safeRedirect = redirectParam.startsWith("/") && !redirectParam.startsWith("//") ? redirectParam : "";

  useEffect(() => {
    const passwordReset = searchParams?.get("passwordReset");
    const logout = searchParams?.get("logout");
    
    if (passwordReset === "true") {
      setSuccess("Tu contraseña fue restablecida correctamente. Ya podés iniciar sesión.");
    } else if (logout === "success") {
      setSuccess("Sesión cerrada correctamente. Podés iniciar sesión nuevamente.");
    }
  }, [searchParams]);

  // Tras mostrar "Bienvenido", guardar sesión y redirigir con recarga completa para que la cookie se envíe
  useEffect(() => {
    if (!showWelcome || !pendingRedirectRef.current) return;
    const { role, safeRedirect: redirect, user } = pendingRedirectRef.current;
    const t = setTimeout(() => {
      let target = redirect || "/";
      switch (role) {
        case "ADMIN":
          target = redirect || "/admin";
          break;
        case "PHOTOGRAPHER":
          sessionStorage.setItem("photographer", JSON.stringify(user));
          sessionStorage.setItem("photographerId", user.id.toString());
          target = redirect || "/fotografo/dashboard";
          break;
        case "LAB":
        case "LAB_PHOTOGRAPHER":
          sessionStorage.setItem("lab", JSON.stringify(user));
          sessionStorage.setItem("labId", user.labId.toString());
          target = redirect || "/lab/dashboard";
          break;
        case "CUSTOMER":
          sessionStorage.setItem("client", JSON.stringify(user));
          sessionStorage.setItem("clientId", user.id.toString());
          target = redirect || "/cliente/dashboard";
          break;
        case "ORGANIZER":
          sessionStorage.setItem("organizer", JSON.stringify(user));
          sessionStorage.setItem("organizerId", user.id.toString());
          target = redirect || "/organizador/dashboard";
          break;
        default:
          target = redirect || "/";
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

      pendingRedirectRef.current = { role, safeRedirect, user: data.user };
      setLoading(false);
      setShowWelcome(true);
    } catch (err: any) {
      setError(err?.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {showWelcome && (
        <SessionTransitionOverlay message="Bienvenido" variant="login" />
      )}
    <section className="py-12 md:py-16 bg-white min-h-screen">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto space-y-8" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
          {/* Header */}
          <div
            style={{
              textAlign: "center",
              padding: "0 16px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              alignItems: "center",
            }}
          >
            <h1
              style={{
                fontSize: "clamp(24px, 5vw, 36px)",
                fontWeight: "normal",
                color: "#1a1a1a",
                lineHeight: "1.3",
                margin: 0,
                width: "100%",
                maxWidth: "800px",
                wordBreak: "normal",
                overflowWrap: "normal",
                whiteSpace: "normal",
              }}
            >
              Iniciar sesión
            </h1>
            <p
              style={{
                fontSize: "clamp(16px, 2.5vw, 18px)",
                color: "#6b7280",
                lineHeight: "1.5",
                margin: 0,
                width: "100%",
                maxWidth: "800px",
                wordBreak: "normal",
                overflowWrap: "normal",
                whiteSpace: "normal",
              }}
            >
              Ingresá tus credenciales para acceder a tu cuenta
            </p>
            <p
              style={{
                fontSize: "14px",
                color: "#6b7280",
                lineHeight: "1.6",
                margin: 0,
                width: "100%",
                maxWidth: "672px",
                wordBreak: "normal",
                overflowWrap: "normal",
                whiteSpace: "normal",
                wordSpacing: "normal",
                letterSpacing: "normal",
                textAlign: "center",
                display: "block",
              }}
            >
              El sistema detectará automáticamente tu tipo de cuenta.
            </p>
          </div>

          <Card className="space-y-6">
            {error && (
              <div className="bg-[#ef4444]/10 border border-[#ef4444] rounded-lg p-4">
                <p className="text-[#ef4444] text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-600 text-sm">{success}</p>
              </div>
            )}

            <Button
              type="button"
              variant="secondary"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => (window.location.href = "/api/auth/google?role=AUTO")}
              disabled={loading}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#e5e7eb]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-[#6b7280]">O</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Contraseña
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#1a1a1a] transition-colors"
                    disabled={loading}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M3 3l18 18"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M10.58 10.58a2 2 0 002.83 2.83"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M6.1 6.1C4.1 7.4 2.6 9.2 2 12c1.6 5 6.1 8 10 8 1.6 0 3.2-.4 4.7-1.2"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9.9 4.3C10.6 4.1 11.3 4 12 4c3.9 0 8.4 3 10 8-.4 1.3-1 2.5-1.8 3.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M1.5 12s4.5-7.5 10.5-7.5S22.5 12 22.5 12 18 19.5 12 19.5 1.5 12 1.5 12Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full"
                  disabled={loading}
                  onKeyDown={(e) => {
                    // Shift + Enter para acceder al login de admin
                    if (e.shiftKey && e.key === "Enter") {
                      e.preventDefault();
                      router.push("/admin/login");
                    }
                  }}
                  onClick={(e) => {
                    // Shift + Click para acceder al login de admin
                    if (e.shiftKey) {
                      e.preventDefault();
                      router.push("/admin/login");
                    }
                  }}
                >
                  {loading ? "Iniciando sesión..." : "Iniciar sesión"}
                </Button>
              </div>

              <div className="text-center">
                <Link
                  href="/forgot-password"
                  className="text-sm text-[#c27b3d] hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </form>

            <div className="text-center pt-4 border-t border-[#e5e7eb]">
              <p className="text-sm text-[#6b7280]">
                ¿No tenés cuenta?{" "}
                <Link href="/registro" className="text-[#c27b3d] hover:underline">
                  Registrate
                </Link>
              </p>
            </div>
          </Card>

          <div className="mt-8 text-center space-y-2">
            <Link href="/" className="text-sm text-[#6b7280] hover:text-[#1a1a1a] block">
              ← Volver al inicio
            </Link>
            <Link href="/privacidad" className="text-xs text-[#6b7280] hover:underline block">
              Política de Privacidad
            </Link>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
