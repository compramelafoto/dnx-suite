type Props = {
  title: string;
  description: string;
  inspirationLabel?: string | null;
  inspirationNotes?: string | null;
};

/** Vista simple estilo participante: título, descripción e inspiración opcional. */
export function ParticipantPromptPreview({
  title,
  description,
  inspirationLabel,
  inspirationNotes,
}: Props) {
  return (
    <article
      className="fr-recuadro space-y-4 border border-fr-border bg-fr-bg-elevated"
      data-testid="participant-prompt-preview"
    >
      <p className="fr-eyebrow text-gold">Vista participante</p>
      <h3 className="font-sans text-xl font-semibold tracking-tight text-fr-primary">{title}</h3>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-fr-muted">{description}</p>
      {inspirationLabel ? (
        <div className="border-t border-fr-border pt-4">
          <p className="text-xs uppercase tracking-wide text-fr-muted">Inspiración</p>
          <p className="mt-2 text-sm font-medium text-fr-primary">{inspirationLabel}</p>
          {inspirationNotes ? (
            <p className="mt-2 text-sm leading-relaxed text-fr-muted">{inspirationNotes}</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
