"use client";

import { useState } from "react";

/**
 * Cómo sale un diploma de esa plantilla, dibujado por el mismo motor que lo emite.
 * `version` cambia cuando la plantilla se edita, para no mostrar una imagen vieja.
 */
export function DiplomaTemplatePreviewImage({
  templateId,
  version,
  alt,
}: {
  templateId: string;
  version?: number;
  alt: string;
}) {
  const [estado, setEstado] = useState<"cargando" | "ok" | "error">("cargando");
  const src = `/api/fotorank/diplomas/templates/${encodeURIComponent(templateId)}/preview?v=${version ?? 0}`;
  return (
    <div className="relative h-full w-full">
      {estado !== "ok" ? (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-fr-muted">
          {estado === "cargando" ? "Dibujando vista previa…" : "No se pudo dibujar la vista previa."}
        </div>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- PNG generado al vuelo, no optimizable */}
      <img
        src={src}
        alt={alt}
        className={`h-full w-full object-contain ${estado === "ok" ? "" : "opacity-0"}`}
        onLoad={() => setEstado("ok")}
        onError={() => setEstado("error")}
      />
    </div>
  );
}
