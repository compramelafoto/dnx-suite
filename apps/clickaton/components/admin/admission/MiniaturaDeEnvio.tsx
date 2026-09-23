"use client";

/**
 * La fotografía de una entrega dentro del panel.
 *
 * Los bytes salen de `/api/admin/submissions/[id]/preview`, que pide sesión de
 * administración: el bucket es privado y no se publica ninguna URL permanente.
 * Si el archivo no está o no carga, queda el cartel y la pantalla sigue
 * funcionando.
 */
import { useState } from "react";
import { cn } from "@/lib/cn";

export function MiniaturaDeEnvio({
  submissionId,
  alt,
  className,
  abreEnPestana = false,
}: {
  submissionId: string;
  alt: string;
  className?: string;
  abreEnPestana?: boolean;
}) {
  const [fallo, setFallo] = useState(false);

  if (fallo) {
    return (
      <span
        className={cn(
          "flex items-center justify-center rounded-[var(--ck-radius-sm)] border border-dashed border-ck-border px-2 text-center text-xs text-ck-text-muted",
          className,
        )}
        role="img"
        aria-label={`Sin vista previa: ${alt}`}
      >
        Sin vista previa
      </span>
    );
  }

  const imagen = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/admin/submissions/${submissionId}/preview`}
      alt={alt}
      className={cn("rounded-[var(--ck-radius-sm)] border border-ck-border", className)}
      onError={() => setFallo(true)}
    />
  );

  if (!abreEnPestana) return imagen;

  return (
    <a
      href={`/api/admin/submissions/${submissionId}/preview?original=1`}
      target="_blank"
      rel="noreferrer"
      title="Abrir la fotografía en tamaño original"
    >
      {imagen}
    </a>
  );
}
