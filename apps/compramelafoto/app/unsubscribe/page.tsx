"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error" | "missing">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("missing");
      setMessage("Falta el token de baja. Usá el link que recibiste en el email.");
      return;
    }

    fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`, {
      method: "POST",
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          setStatus("success");
          setMessage("Te diste de baja correctamente. Ya no recibirás más emails de marketing de ComprameLaFoto.");
        } else {
          setStatus("error");
          setMessage(data.error || "No se pudo procesar la baja. El link puede haber expirado.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Error de conexión. Intentá de nuevo más tarde.");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        {status === "loading" && (
          <p className="text-gray-600">Procesando...</p>
        )}
        {status === "success" && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Baja exitosa</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <Link href="/" className="text-[#c27b3d] font-medium hover:underline">
              Volver al inicio
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <Link href="/" className="text-[#c27b3d] font-medium hover:underline">
              Volver al inicio
            </Link>
          </>
        )}
        {status === "missing" && (
          <>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Link inválido</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <Link href="/" className="text-[#c27b3d] font-medium hover:underline">
              Volver al inicio
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-600">Cargando...</p></div>}>
      <UnsubscribeContent />
    </Suspense>
  );
}
