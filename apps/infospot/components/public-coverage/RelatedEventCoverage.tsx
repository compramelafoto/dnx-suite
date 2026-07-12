import Link from "next/link";
import type { PublicRelatedArticle, PublicRelatedEvent } from "@/lib/public-coverage";

type Props = {
  articles?: PublicRelatedArticle[];
  events?: PublicRelatedEvent[];
  articlesHeading?: string;
  eventsHeading?: string;
};

/** Contenidos relacionados del evento / cobertura. */
export function RelatedEventCoverage({
  articles = [],
  events = [],
  articlesHeading = "Más sobre este evento",
  eventsHeading = "Eventos relacionados",
}: Props) {
  if (articles.length === 0 && events.length === 0) return null;

  return (
    <div className="mt-14 space-y-12" data-testid="related-event-coverage">
      {articles.length > 0 ? (
        <section aria-labelledby="related-articles-heading">
          <h2 id="related-articles-heading" className="is-title-section text-2xl">
            {articlesHeading}
          </h2>
          <ul className="mt-6 space-y-4">
            {articles.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/noticias/${a.slug}`}
                  className="group block rounded-[var(--is-radius)] border border-[var(--is-border)] p-4 hover:border-[var(--is-accent)]"
                >
                  <p className="font-semibold group-hover:text-[var(--is-accent)]">
                    {a.title}
                  </p>
                  {a.excerpt ? (
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--is-muted)]">
                      {a.excerpt}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {events.length > 0 ? (
        <section aria-labelledby="related-events-heading">
          <h2 id="related-events-heading" className="is-title-section text-2xl">
            {eventsHeading}
          </h2>
          <ul className="mt-6 space-y-4">
            {events.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/eventos/${e.slug}`}
                  className="group block rounded-[var(--is-radius)] border border-[var(--is-border)] p-4 hover:border-[var(--is-accent)]"
                >
                  <p className="text-xs uppercase tracking-wide text-[var(--is-muted)]">
                    {[e.temporalLabel, e.city, e.province].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-1 font-semibold group-hover:text-[var(--is-accent)]">
                    {e.title}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
