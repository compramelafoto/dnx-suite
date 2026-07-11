import type { ClfAlbumAvailabilityResult } from "@repo/db";

type Props = {
  availability: ClfAlbumAvailabilityResult;
  reactivationUrl?: string | null;
};

export function AlbumCommerceCta({ availability, reactivationUrl }: Props) {
  if (availability.status === "AVAILABLE") {
    return (
      <div className="mt-12 rounded-[var(--is-radius-lg)] border border-[var(--is-border)] bg-[var(--is-bg-secondary)] p-6 md:p-8">
        <p className="is-body">
          Las fotografías de este evento están disponibles para la compra.
        </p>
        <a
          href={availability.publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="is-btn is-btn-primary mt-5"
        >
          Comprar fotos del evento
        </a>
      </div>
    );
  }

  if (availability.status === "REACTIVATABLE") {
    const href =
      reactivationUrl?.trim() ||
      process.env.INFOSPOT_REACTIVATION_URL?.trim() ||
      availability.publicUrl;
    return (
      <div className="mt-12 rounded-[var(--is-radius-lg)] border border-[var(--is-warning)]/30 bg-[var(--is-warning-soft)] p-6 md:p-8">
        <p className="text-sm leading-relaxed text-[var(--is-warning)]">
          El álbum ya no está publicado, pero todavía puede solicitarse su reactivación.
        </p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="is-btn is-btn-secondary mt-5 border-[var(--is-warning)] text-[var(--is-warning)]"
        >
          Solicitar reactivación
        </a>
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
