import type { PublicCoverageAlbum } from "@/lib/public-coverage";

type Props = {
  albums: PublicCoverageAlbum[];
  title?: string;
};

/**
 * «Fotos de este evento disponibles» — solo álbumes AVAILABLE con CTA.
 */
export function CoverageAlbumsCommerce({
  albums,
  title = "Fotos de este evento disponibles",
}: Props) {
  const visible = albums.filter(
    (a) =>
      a.commercialStatus === "AVAILABLE" &&
      a.canShowPurchaseCta &&
      (a.trackedAlbumHref || a.trackedPurchaseHref),
  );

  if (visible.length === 0) return null;

  return (
    <section className="mt-14" aria-labelledby="coverage-albums-heading" data-testid="coverage-albums-commerce">
      <h2 id="coverage-albums-heading" className="is-title-section text-2xl">
        {title}
      </h2>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {visible.map((album) => (
          <li
            key={album.clfAlbumId}
            className="rounded-[var(--is-radius)] border border-[var(--is-border)] bg-[var(--is-surface)] p-5"
          >
            <p className="font-semibold">{album.title}</p>
            {album.photographerName ? (
              <p className="mt-1 text-sm text-[var(--is-muted)]">
                {album.photographerName}
              </p>
            ) : null}
            {album.photoCount != null ? (
              <p className="mt-1 text-sm text-[var(--is-muted)]">
                {album.photoCount} fotos
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              {album.trackedAlbumHref ? (
                <a
                  href={album.trackedAlbumHref}
                  className="is-btn is-btn-ghost min-h-11 text-sm"
                  rel="noopener noreferrer"
                >
                  Ver álbum completo
                </a>
              ) : null}
              {album.trackedPurchaseHref ? (
                <a
                  href={album.trackedPurchaseHref}
                  className="is-btn is-btn-primary min-h-11 text-sm"
                  rel="noopener noreferrer"
                >
                  Comprar fotos
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
