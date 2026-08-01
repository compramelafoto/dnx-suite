/**
 * Vista previa estructural.
 * Las keys privadas no se exponen por /api/media; no inventamos un proxy nuevo.
 */
type Props = {
  participantName: string;
  promptLabel: string;
  hasPreview: boolean;
  hasOriginal: boolean;
};

export function SubmissionPhotoPreview({
  participantName,
  promptLabel,
  hasPreview,
  hasOriginal,
}: Props) {
  const hasFile = hasPreview || hasOriginal;

  return (
    <div
      className="flex min-h-[12rem] w-full max-w-full items-center justify-center overflow-hidden rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface-strong px-4 py-8"
      role="img"
      aria-label={
        hasFile
          ? `Fotografía de ${participantName} para ${promptLabel}`
          : `Sin vista previa de ${participantName}`
      }
    >
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-ck-text">
          {hasFile ? "No pudimos mostrar la vista previa" : "No hay fotografía disponible"}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ck-text-muted">
          {hasFile
            ? "El archivo sigue registrado. Podés revisar la información técnica o intentar nuevamente cuando exista un acceso seguro de previsualización."
            : "Todavía no hay un archivo asociado a esta entrega."}
        </p>
      </div>
    </div>
  );
}
