"use client";

import { useState, useTransition } from "react";
import { descargarParteAction } from "@/app/w/[workspaceSlug]/galeria/[token]/acciones";
import type { ParteVista } from "@/lib/galerias/descargas";

/** Una lista de botones «Descargar parte N»: al hacer clic se firma un enlace de 5 minutos y empieza la descarga. */
export function DescargarPartes({ slug, token, descargaId, partes }: { slug: string; token: string; descargaId: string; partes: ParteVista[] }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function bajar(p: ParteVista) {
    setError(null);
    iniciar(async () => {
      const r = await descargarParteAction(slug, token, descargaId, p.tipo, p.n).catch(() => null);
      if (!r) return setError("No pudimos conectar con el servidor. Probá de nuevo.");
      if (!r.ok) return setError(r.error);
      const a = document.createElement("a");
      a.href = r.url;
      a.rel = "noreferrer noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {partes.map((p) => (
          <li key={`${p.tipo}-${p.n}`}>
            <button type="button" onClick={() => bajar(p)} disabled={pendiente} className="fo-btn fo-btn-secondary w-full justify-between sm:w-auto">
              {p.tipo === "ZIP" ? `Descargar parte ${p.n} (${p.tamano})` : `Descargar ${p.etiqueta} (${p.tamano})`}
            </button>
            {p.tipo === "ZIP" ? (
              <span className="ml-2 text-sm opacity-70">
                {p.archivos.toLocaleString("es-AR")} {p.archivos === 1 ? "archivo" : "archivos"}
              </span>
            ) : (
              <span className="ml-2 text-sm opacity-70">Es muy grande para un ZIP: se baja directo.</span>
            )}
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
