"use client";

/**
 * Vista previa de la entrega en el panel.
 *
 * Los bytes salen de `/api/admin/submissions/[id]/preview`, que pide sesión de
 * administración: el bucket es privado y no se publica ninguna URL permanente.
 * Si la imagen no carga queda el cartel de siempre, sin romper la pantalla.
 */
import { useState } from "react";

type Props = {
  submissionId: string;
  participantName: string;
  promptLabel: string;
  hasPreview: boolean;
  hasOriginal: boolean;
};

export function SubmissionPhotoPreview({
  submissionId,
  participantName,
  promptLabel,
  hasPreview,
  hasOriginal,
}: Props) {
  const hasFile = hasPreview || hasOriginal;
  const [fallo, setFallo] = useState(false);

  if (hasFile && !fallo) {
    return (
      <div className="flex w-full max-w-full items-center justify-center overflow-hidden rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface-strong">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/admin/submissions/${submissionId}/preview`}
          alt={`Fotografía de ${participantName} para ${promptLabel}`}
          className="max-h-[32rem] w-auto max-w-full object-contain"
          onError={() => setFallo(true)}
        />
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[12rem] w-full max-w-full items-center justify-center overflow-hidden rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface-strong px-4 py-8"
      role="img"
      aria-label={
        hasFile
          ? `No se pudo mostrar la fotografía de ${participantName}`
          : `Sin vista previa de ${participantName}`
      }
    >
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-ck-text">
          {hasFile ? "No pudimos mostrar la vista previa" : "No hay fotografía disponible"}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ck-text-muted">
          {hasFile
            ? "El archivo sigue registrado. Revisá la información técnica y probá recargar la página."
            : "Todavía no hay un archivo asociado a esta entrega."}
        </p>
      </div>
    </div>
  );
}
