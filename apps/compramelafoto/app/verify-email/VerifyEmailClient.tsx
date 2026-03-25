"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function VerifyEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams?.get("token");
    if (!token) {
      setError("Token inválido o faltante");
      setLoading(false);
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "No se pudo verificar el email");
        }
        setSuccess(true);
        setTimeout(() => {
          router.push("/login?emailVerified=true");
        }, 2500);
      } catch (err: any) {
        setError(err?.message || "No se pudo verificar el email");
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [router, searchParams]);

  return (
    <section className="py-12 md:py-16 bg-white min-h-screen">
      <div className="container-custom">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Verificación de email
            </h1>
            <p className="text-gray-600">
              Estamos validando tu email para activar tu cuenta.
            </p>
          </div>

          <Card className="space-y-6">
            {loading && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-gray-600 text-sm">Verificando tu email...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-600 text-sm">
                  ¡Email verificado correctamente! Te redirigimos al login.
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-gray-200 text-center">
              <Link href="/login">
                <Button variant="primary" className="w-full sm:w-auto">
                  Ir al login
                </Button>
              </Link>
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
