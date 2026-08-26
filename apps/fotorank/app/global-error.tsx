"use client";

import "./globals.css";

/**
 * Boundary de último recurso: solo se activa si el propio layout raíz
 * (`app/layout.tsx`) falla al renderizar. Reemplaza <html>/<body> por
 * completo (requisito de Next.js), por eso reimporta `globals.css` acá.
 * Deliberadamente estático — sin fetch, sin resolvers, sin dependencias
 * de sesión — para no arriesgarse a fallar también.
 */
export default function FotorankGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="antialiased">
        <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6 py-16">
          <div className="fr-recuadro border border-fr-border bg-fr-card">
            <h1 className="text-2xl font-semibold tracking-tight">
              FotoRank no está disponible
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-fr-muted">
              Estamos con un problema general de la aplicación. Reintentá en unos
              minutos; si el problema sigue, contactá soporte con el código de abajo.
            </p>
            {error.digest ? (
              <p className="mt-4 font-mono text-xs text-fr-muted">Código: {error.digest}</p>
            ) : null}
            <div className="mt-8">
              <button
                type="button"
                onClick={() => reset()}
                className="fr-btn fr-btn-primary px-6 py-3"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
