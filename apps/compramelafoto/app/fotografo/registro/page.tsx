"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function PhotographerRegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    router.replace("/registro");
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("El nombre es requerido");
      return;
    }

    if (!email.trim()) {
      setError("El email es requerido");
      return;
    }

    if (!password.trim()) {
      setError("La contraseña es requerida");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register-photographer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Error en el registro");
      }

      // Redirigir al login
      router.push("/fotografo/login?registered=true");
    } catch (err: any) {
      setError(err?.message || "Error al registrarse");
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
              Crear cuenta
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
              Registrate como fotógrafo para comenzar
            </p>
            <Card className="bg-amber-50 border border-amber-200 max-w-2xl">
              <p className="text-sm text-amber-800 font-medium">
                ⚠️ Para operar en la plataforma es obligatorio vincular Mercado Pago. Sin esa conexión no podrás crear álbumes ni recibir cobros.
              </p>
            </Card>
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
              Creá tu cuenta con email y contraseña o usá tu cuenta de Google para registrarte rápidamente.
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
                  Nombre completo
                </label>
                <Input
                  type="text"
                  placeholder="Juan Pérez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

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
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                />
                <p className="text-xs text-[#6b7280] mt-1">
                  Mínimo 6 caracteres
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  Confirmar contraseña
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Creando cuenta..." : "Crear cuenta"}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#e5e7eb]"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-[#6b7280]">O</span>
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                className="w-full flex items-center justify-center gap-2"
                onClick={() => window.location.href = "/api/auth/google"}
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
                Registrarse con Google
              </Button>
            </form>

            <div className="text-center pt-4 border-t border-[#e5e7eb]">
              <p className="text-sm text-[#6b7280]">
                ¿Ya tenés cuenta?{" "}
                <Link href="/fotografo/login" className="text-[#c27b3d] hover:underline">
                  Iniciar sesión
                </Link>
              </p>
            </div>
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
