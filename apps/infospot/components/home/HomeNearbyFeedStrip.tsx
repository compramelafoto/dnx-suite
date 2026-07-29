import Link from "next/link";
import type { InfoSpotFeedItem } from "@/lib/feed/types";

/**
 * Lista compacta de convocatorias / actividades cercanas (Home).
 */
export function HomeNearbyFeedStrip({
  title,
  eyebrow,
  description,
  items,
  emptyHint,
  id,
}: {
  title: string;
  eyebrow: string;
  description?: string;
  items: InfoSpotFeedItem[];
  emptyHint?: string;
  id: string;
}) {
  if (items.length === 0) {
    if (!emptyHint) return null;
    return (
      <section id={id} aria-labelledby={`${id}-heading`} className="space-y-4">
        <p className="is-eyebrow">{eyebrow}</p>
        <h2 id={`${id}-heading`} className="is-h2 text-2xl md:text-3xl">
          {title}
        </h2>
        <p className="is-body text-[var(--is-muted)]">{emptyHint}</p>
      </section>
    );
  }

  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="space-y-6">
      <div className="max-w-2xl">
        <p className="is-eyebrow">{eyebrow}</p>
        <h2 id={`${id}-heading`} className="is-h2 mt-3 text-2xl md:text-3xl">
          {title}
        </h2>
        {description ? <p className="is-body mt-3">{description}</p> : null}
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.publicUrl}
              className="flex flex-col gap-1 rounded-xl border border-[var(--is-border)] bg-[var(--is-surface)] px-5 py-4 transition hover:border-[var(--is-accent)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--is-muted)]">
                  {item.typeLabel}
                  {item.statusLabel ? ` · ${item.statusLabel}` : null}
                </p>
                <p className="mt-1 font-semibold text-[var(--is-fg)]">{item.title}</p>
              </div>
              <p className="text-sm text-[var(--is-muted)]">
                {item.distanceLabel || item.locationLabel}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
