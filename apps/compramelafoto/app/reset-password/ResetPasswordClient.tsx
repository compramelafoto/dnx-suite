"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const tokenParam = searchParams?.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError("Token de recuperación no válido o faltante");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validaciones
    if (!token) {
      setError("Token de recuperación no válido");
      return;
    }

    if (!password || password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Error al restablecer la contraseña");
      }

      setSuccess(true);
      // Redirigir al login después de 3 segundos
      setTimeout(() => {
        router.push("/login?passwordReset=true");
      }, 3000);
    } catch (err: any) {
      setError(err?.message || "Error al restablecer la contraseña");
    } finally {
      setLoading(false);
    }
  }

  if (!token && !error) {
    return (
      <section className="py-12 md:py-16 bg-white min-h-screen">
        <div className="container-custom">
          <div className="max-w-6xl mx-auto">
            <Card className="p-6">
              <p className="text-gray-600 text-center">Cargando...</p>
            </Card>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 md:py-16 bg-white min-h-screen">
      <div className="container-custom">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Restablecer Contraseña
            </h1>
            <p className="text-gray-600">
              Ingresá tu nueva contraseña
            </p>
          </div>

          <Card className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-600 text-sm">
                  ¡Contraseña restablecida correctamente! Redirigiendo al login...
                </p>
              </div>
            )}

            {!success && (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nueva Contraseña
                  </label>
                  <Input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    La contraseña debe tener al menos 6 caracteres
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirmar Contraseña
                  </label>
                  <Input
                    type="password"
                    placeholder="Repetí la contraseña"
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
                  {loading ? "Restableciendo..." : "Restablecer Contraseña"}
                </Button>
              </form>
            )}

            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <Link href="/login" className="text-[#c27b3d] hover:underline">
                  Volver al login
                </Link>
              </p>
            </div>
          </Card>

          <div className="text-center">
            <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
