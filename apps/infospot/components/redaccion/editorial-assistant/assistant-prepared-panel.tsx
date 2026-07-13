/**
 * Panel del drawer derecho cuando la historia viene del Asistente Editorial.
 * Lenguaje periodístico; sin términos técnicos.
 */
export function AssistantPreparedPanel({
  eventTitle,
  albumTitle,
  linkedPhotoCount,
  sourceName,
}: {
  eventTitle?: string | null;
  albumTitle?: string | null;
  linkedPhotoCount?: number;
  sourceName?: string | null;
}) {
  return (
    <section
      className="rounded-[var(--is-radius-md)] border border-[var(--is-accent)]/40 bg-[var(--is-accent)]/5 p-4"
      aria-labelledby="assistant-prepared-heading"
    >
      <h2
        id="assistant-prepared-heading"
        className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--is-accent)]"
      >
        Preparado por el asistente
      </h2>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[var(--is-text)]">
        <li>
          <span className="text-[var(--is-muted)]">Evento · </span>
          {eventTitle || "Sin evento"}
        </li>
        <li>
          <span className="text-[var(--is-muted)]">Material editorial · </span>
          {albumTitle || "Sin coberturas vinculadas"}
        </li>
        <li>
          <span className="text-[var(--is-muted)]">Fotografías · </span>
          {linkedPhotoCount != null ? `${linkedPhotoCount} listas` : "Disponibles en el selector"}
        </li>
        <li>
          <span className="text-[var(--is-muted)]">Autor · </span>
          {sourceName || "El de la sesión"}
        </li>
        <li className="text-[var(--is-muted)]">
          SEO y publicación se completan acá cuando la historia esté lista.
        </li>
      </ul>
    </section>
  );
}
