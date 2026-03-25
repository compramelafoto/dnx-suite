"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Error al procesar la solicitud");
      }

      setSuccess(data.message || "Si el email existe, recibirás un enlace para restablecer tu contraseña.");
      setEmail(""); // Limpiar email por seguridad
    } catch (err: any) {
      setError(err?.message || "Error al procesar la solicitud");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="py-12 md:py-16 bg-white min-h-screen">
      <div className="container-custom">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              ¿Olvidaste tu contraseña?
            </h1>
            <p className="text-gray-600">
              Ingresá tu email y te enviaremos un enlace para restablecer tu contraseña.
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
                <p className="text-green-600 text-sm">{success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading || !!success}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={loading || !!success}
              >
                {loading ? "Enviando..." : success ? "Email Enviado" : "Enviar Enlace de Recuperación"}
              </Button>
            </form>

            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                ¿Recordaste tu contraseña?{" "}
                <Link href="/login" className="text-[#c27b3d] hover:underline">
                  Iniciar sesión
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
