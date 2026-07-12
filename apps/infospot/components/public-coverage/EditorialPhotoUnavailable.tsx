type Props = {
  caption?: string | null;
  revoked?: boolean;
};

/** Placeholder digno cuando la foto no puede mostrarse (REVOKED / no ready). */
export function EditorialPhotoUnavailable({ caption, revoked }: Props) {
  return (
    <figure
      className="flex min-h-[12rem] flex-col justify-center rounded-[var(--is-radius)] border border-dashed border-[var(--is-border)] bg-[var(--is-surface-muted)] px-6 py-10 text-center"
      data-testid="editorial-photo-unavailable"
      aria-label="Fotografía no disponible"
    >
      <p className="text-sm font-medium text-[var(--is-text)]">
        {revoked
          ? "Esta fotografía ya no está disponible para publicación."
          : "Esta fotografía no está disponible en este momento."}
      </p>
      {caption?.trim() ? (
        <p className="mt-3 text-sm text-[var(--is-muted)]">{caption}</p>
      ) : null}
    </figure>
  );
}
