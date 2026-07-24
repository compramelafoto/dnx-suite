import type { ClfAlbumAvailabilityResult } from "@repo/db/clf-album-availability";

type Props = {
  availability: ClfAlbumAvailabilityResult;
  /** Solo para Director: enlace interno de reactivación (no compra pública). */
  directorReactivationUrl?: string | null;
  showDirectorActions?: boolean;
  /** Para tracking seguro vía /api/r */
  articleId?: string | null;
  eventId?: string | null;
};

function trackedHref(
  to: string,
  kind: "ALBUM_CLICK" | "PURCHASE_CLICK",
  articleId?: string | null,
  eventId?: string | null,
): string {
  const params = new URLSearchParams({ to, kind });
  if (articleId) params.set("articleId", articleId);
  if (eventId) params.set("eventId", eventId);
  return `/api/r?${params.toString()}`;
}

/**
 * Bloque público «Ver y comprar las fotos del evento».
 * AVAILABLE → CTA activo a CLF vía /api/r (anti open-redirect + métrica).
 */
export function AlbumCommerceCta({
  availability,
  directorReactivationUrl,
  showDirectorActions = false,
  articleId,
  eventId,
}: Props) {
  if (availability.status === "AVAILABLE") {
    return (
      <div className="mt-12 rounded-[var(--is-radius-lg)] border border-[var(--is-border)] bg-[var(--is-bg-secondary)] p-6 md:p-8">
        <p className="is-body">Ver y comprar las fotos del evento</p>
        <a
          href={trackedHref(availability.publicUrl, "ALBUM_CLICK", articleId, eventId)}
          rel="noopener noreferrer"
          className="is-btn is-btn-primary mt-5"
        >
          Ver y comprar las fotos del evento
        </a>
      </div>
    );
  }

  if (availability.status === "REACTIVATABLE") {
    const internalHref =
      directorReactivationUrl?.trim() ||
      process.env.INFOSPOT_REACTIVATION_URL?.trim() ||
      null;

    return (
      <div className="mt-12 rounded-[var(--is-radius-lg)] border border-[var(--is-warning)]/30 bg-[var(--is-warning-soft)] p-6 md:p-8">
        <p className="text-sm leading-relaxed text-[var(--is-warning)]">
          El álbum ya no está publicado para la venta. Todavía puede reactivarse según las reglas
          comerciales de ComprameLaFoto (sin compra directa desde esta nota).
        </p>
        {showDirectorActions && internalHref ? (
          <a
            href={internalHref}
            target="_blank"
            rel="noopener noreferrer"
            className="is-btn is-btn-secondary mt-5 border-[var(--is-warning)] text-[var(--is-warning)]"
          >
            Solicitar o gestionar reactivación (Director)
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-12 rounded-[var(--is-radius-lg)] border border-[var(--is-border)] bg-[var(--is-surface-muted)] p-6 md:p-8">
      <p className="is-meta text-sm">
        Las fotografías de este evento ya no están disponibles para la venta.
      </p>
    </div>
  );
}
