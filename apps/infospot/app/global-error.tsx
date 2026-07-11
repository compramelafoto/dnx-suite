"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[infospot]", error.digest || error.message);
  }, [error]);

  return (
    <html lang="es-AR">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center text-[#203038]">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6b7380]">
          Error
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Algo salió mal</h1>
        <p className="max-w-md text-sm text-[#4a5160]">
          Estamos trabajando para resolverlo. Podés reintentar o volver al inicio.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-11 items-center bg-[#203038] px-5 text-sm font-semibold text-white"
          >
            Reintentar
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center px-5 text-sm font-medium ring-1 ring-[#e4e7ec]"
          >
            Ir al inicio
          </Link>
        </div>
      </body>
    </html>
  );
}
