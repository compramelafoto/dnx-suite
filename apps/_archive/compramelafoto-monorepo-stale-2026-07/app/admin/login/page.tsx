"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export const dynamic = 'force-dynamic';

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirectParam = searchParams?.get("redirect") || "";
  const safeRedirect = redirectParam.startsWith("/") && !redirectParam.startsWith("//") ? redirectParam : "";

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

      // Verificar que sea ADMIN
      if (data.user?.role !== "ADMIN") {
        throw new Error("Esta cuenta no es de administrador.");
      }

      // Redirigir con recarga completa para que la cookie se envíe en la siguiente carga
      window.location.href = safeRedirect || "/admin";
    } catch (err: any) {
      setError(err?.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="py-12 md:py-16 bg-white">
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
              Iniciar sesión - Administrador
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
              Accedé al panel de administración
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
              Solo usuarios con rol ADMIN pueden acceder a esta sección.
            </p>
          </div>

          <Card className="space-y-6">
            {error && (
              <div className="bg-[#ef4444]/10 border border-[#ef4444] rounded-lg p-4">
                <p className="text-[#ef4444] text-sm">{error}</p>
              </div>
            )}

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

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Iniciando sesión..." : "Iniciar sesión"}
              </Button>

              <div className="text-center">
                <Link
                  href="/forgot-password"
                  className="text-sm text-[#c27b3d] hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </form>
          </Card>

          <div className="mt-8 text-center">
            <Link href="/" className="text-sm text-[#6b7280] hover:text-[#1a1a1a]">
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <section className="py-12 md:py-16 bg-white">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-gray-600">Cargando...</p>
          </div>
        </div>
      </section>
    }>
      <AdminLoginContent />
    </Suspense>
  );
}
