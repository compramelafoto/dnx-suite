"use client";

import Link from "next/link";

/**
 * Red de seguridad general para excepciones no capturadas en cualquier ruta
 * bajo el layout raíz (no solo login). Es un boundary VISUAL: no reemplaza
 * el manejo fail-closed de `resolveHomeCapabilities` ni de ningún resolver;
 * solo evita que una falla imprevista en OTRA parte de la app muestre la
 * pantalla genérica de Next.js sin salida.
 *
 * No hace fetch ni llama a resolvers propios: si volviera a fallar, quedaría
 * sin red de seguridad. `error.digest` es el identificador de Next.js
 * correlacionable con los runtime logs de Vercel para este error puntual.
 */
export default function FotorankErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <div className="fr-recuadro border border-fr-border bg-fr-card">
        <h1 className="text-2xl font-semibold tracking-tight">Ocurrió un error</h1>
        <p className="mt-4 text-sm leading-relaxed text-fr-muted">
          Podés reintentar o volver al inicio; si el problema sigue, contactá
          soporte con el código de abajo.
        </p>
        {error.digest ? (
          <p className="mt-4 font-mono text-xs text-fr-muted">Código: {error.digest}</p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => reset()}
            className="fr-btn fr-btn-primary px-6 py-3"
          >
            Reintentar
          </button>
          <Link
            href="/"
            className="rounded-lg border border-fr-border px-6 py-3 text-sm text-fr-muted transition-colors hover:border-gold/40 hover:text-gold"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
