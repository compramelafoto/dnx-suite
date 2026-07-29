import Link from "next/link";
import type { InfoSpotFeedItem } from "@/lib/feed/types";

function typeEmoji(type: InfoSpotFeedItem["type"]): string {
  switch (type) {
    case "EVENT":
    case "CONTEST":
      return "📅";
    case "PHOTOGRAPHER_CALL":
      return "📸";
    case "COVERAGE":
      return "📷";
    default:
      return "📰";
  }
}

/**
 * Bloque “También cerca de este lugar” — detalle de nota georreferenciada.
 */
export function AlsoNearThisPlaceBlock({
  items,
  placeLabel,
}: {
  items: InfoSpotFeedItem[];
  placeLabel?: string | null;
}) {
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="also-near-heading"
      className="space-y-6 border-t border-[var(--is-border)] pt-10"
    >
      <div className="max-w-2xl">
        <p className="is-eyebrow">Cercanía</p>
        <h2 id="also-near-heading" className="is-h2 mt-3 text-2xl md:text-3xl">
          También cerca de este lugar
        </h2>
        <p className="is-body mt-3">
          {placeLabel
            ? `Otras novedades cerca de ${placeLabel}.`
            : "Otras noticias, actividades y convocatorias cercanas."}
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.publicUrl}
              className="block rounded-xl border border-[var(--is-border)] bg-[var(--is-surface)] p-5 transition hover:border-[var(--is-accent)]"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
                {typeEmoji(item.type)} {item.typeLabel}
                {item.distanceLabel ? ` · ${item.distanceLabel}` : null}
              </p>
              <p className="mt-2 text-base font-semibold leading-snug text-[var(--is-fg)]">
                {item.title}
              </p>
              {item.locationLabel ? (
                <p className="mt-2 text-sm text-[var(--is-muted)]">{item.locationLabel}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
