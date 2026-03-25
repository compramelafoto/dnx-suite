"use client";

import { useEffect } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";

export default function OrganizadorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Panel organizador:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 sm:px-6">
      <div className="w-full max-w-xl min-w-[min(100%,320px)] text-center space-y-5">
        <h1 className="text-xl font-semibold text-gray-900">Algo salió mal</h1>
        <p className="text-gray-600 text-sm max-w-prose mx-auto">
          Hubo un error al cargar el panel del organizador. Probá de nuevo o volvé al inicio.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="primary" onClick={reset}>
            Reintentar
          </Button>
          <Link href="/">
            <Button variant="secondary">Ir al inicio</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary">Iniciar sesión</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
