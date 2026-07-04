"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

function DeleteBiometricContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interestId, setInterestId] = useState<number | null>(null);

  useEffect(() => {
    // Extraer interestId del token (formato: interestId:email:expiresAt:signature en base64url)
    if (token) {
      try {
        const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
        const decoded = typeof atob !== "undefined" ? atob(base64) : Buffer.from(token, "base64url").toString("utf-8");
        const parts = decoded.split(":");
        const id = parseInt(parts[0], 10);
        if (Number.isFinite(id)) {
          setInterestId(id);
        }
      } catch {
        // Ignorar errores de decodificación
      }
    }
  }, [token]);

  async function handleDelete() {
    if (!token) {
      setError("Token inválido o faltante");
      return;
    }

    if (!interestId) {
      setError("No se pudo identificar el registro");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/interested/${interestId}/delete-biometric`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error eliminando datos biométricos");
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Error eliminando datos biométricos");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-lg w-full min-w-[min(100%,320px)] p-6">
          <h1 className="text-2xl font-bold text-[#1a1a1a] mb-4">Token inválido</h1>
          <p className="text-[#6b7280] mb-4">
            El enlace de eliminación de datos biométricos no es válido o ha expirado.
          </p>
          <Button
            variant="primary"
            onClick={() => router.push("/")}
            className="w-full"
          >
            Volver al inicio
          </Button>
        </Card>
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-lg w-full min-w-[min(100%,320px)] p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#1a1a1a] mb-4">Datos eliminados</h1>
            <p className="text-[#6b7280] mb-6">
              Tus datos biométricos (selfie y reconocimiento facial) han sido eliminados exitosamente.
            </p>
            <p className="text-sm text-[#9ca3af] mb-6">
              Tus datos de contacto (email y WhatsApp) se mantienen para futuras notificaciones del álbum.
            </p>
            <Button
              variant="primary"
              onClick={() => router.push("/")}
              className="w-full"
            >
              Volver al inicio
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-lg w-full min-w-[min(100%,320px)] p-6">
        <h1 className="text-2xl font-bold text-[#1a1a1a] mb-4">Eliminar datos biométricos</h1>
        <p className="text-[#6b7280] mb-6">
          ¿Estás seguro de que querés eliminar tus datos biométricos (selfie y reconocimiento facial)?
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-800">
            <strong>Importante:</strong> Esta acción eliminará tu selfie y los datos de reconocimiento facial.
            Tus datos de contacto (email y WhatsApp) se mantendrán para futuras notificaciones del álbum.
          </p>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        <div className="flex gap-3">
          <Button
            variant="primary"
            onClick={handleDelete}
            disabled={loading}
            className="flex-1"
          >
            {loading ? "Eliminando..." : "Sí, eliminar"}
          </Button>
          <Button
            onClick={() => router.push("/")}
            disabled={loading}
            className="flex-1"
            style={{ backgroundColor: "#e5e7eb", color: "#1a1a1a" }}
          >
            Cancelar
          </Button>
        </div>
      </Card>
    </main>
  );
}

export default function DeleteBiometricPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-lg w-full min-w-[min(100%,320px)] p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#c27b3d] mx-auto mb-4"></div>
            <p className="text-[#6b7280]">Cargando...</p>
          </div>
        </Card>
      </main>
    }>
      <DeleteBiometricContent />
    </Suspense>
  );
}
