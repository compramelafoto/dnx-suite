"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { codigoDeError, esVersionVieja, type AlcanceError } from "@/lib/errores/error-pantalla-puro";

/**
 * Lo que se ve cuando una pantalla se cae, en lugar del «This page couldn't load» de Next.
 *
 * Al montarse le manda el detalle al servidor (`/api/errores-pantalla`), que lo guarda; el código
 * corto que devuelve se muestra para que la persona lo pueda pasar y encontremos la falla.
 */
export function PantallaDeError({
  error,
  reintentar,
  alcance,
}: {
  error: Error & { digest?: string };
  reintentar: () => void;
  alcance: AlcanceError;
}) {
  const [codigo, setCodigo] = useState<string | null>(null);
  const enviado = useRef<Error | null>(null);
  const versionVieja = esVersionVieja(error);

  useEffect(() => {
    // Un mismo error se avisa una sola vez, aunque React monte dos veces en desarrollo.
    if (enviado.current === error) return;
    enviado.current = error;
    console.error(error);
    fetch("/api/errores-pantalla", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        alcance,
        ruta: `${window.location.pathname}${window.location.search}`,
        mensaje: error.message,
        nombre: error.name,
        digest: error.digest,
        pila: error.stack,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((r: { id?: string } | null) => {
        if (r?.id) setCodigo(codigoDeError(r.id));
      })
      .catch(() => {});
  }, [error, alcance]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="fo-card w-full max-w-md text-center">
        <AlertTriangle className="mx-auto size-8 text-[var(--fo-danger)]" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold text-[var(--fo-text)]">
          {versionVieja ? "Hay una versión nueva de FOTOFFICE" : "Esta pantalla tuvo un problema"}
        </h1>
        <p className="mt-2 text-sm text-[var(--fo-muted)]">
          {versionVieja
            ? "Se publicó una actualización mientras tenías la página abierta. Recargala para seguir; lo que ya guardaste no se pierde."
            : "Lo que ya se había guardado no se pierde. Probá de nuevo; si vuelve a pasar, avisanos con el código de abajo."}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {versionVieja ? null : (
            <button type="button" className="fo-btn fo-btn-primary" onClick={reintentar}>
              Reintentar
            </button>
          )}
          <button
            type="button"
            className={`fo-btn ${versionVieja ? "fo-btn-primary" : "fo-btn-secondary"}`}
            onClick={() => window.location.reload()}
          >
            Recargar la página
          </button>
        </div>
        <p className="mt-4 text-xs text-[var(--fo-muted-soft)]" aria-live="polite">
          {codigo ? `Código del error: ${codigo}` : " "}
        </p>
      </div>
    </div>
  );
}
