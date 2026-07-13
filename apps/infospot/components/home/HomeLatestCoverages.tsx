import Link from "next/link";
import type { DistributionCoverageCard } from "@/lib/distribution";
import type { ArticleWithRelations } from "@/lib/articles";
import { toArticleCardProps } from "@/components/editorial/article-cards";

type Props = {
  coverages?: DistributionCoverageCard[];
  /** Compat: artículos genéricos si no hay coberturas vinculadas. */
  articles?: ArticleWithRelations[];
};

function formatDate(d: Date | null) {
  if (!d) return null;
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}

/** Coberturas recientes vinculadas a eventos (o fallback a notas publicadas). */
export function HomeLatestCoverages({ coverages, articles }: Props) {
  const fromDist =
    coverages?.map((c) => ({
      href: `/noticias/${c.slug}`,
      title: c.title,
      imageUrl: c.coverImageUrl,
      excerpt: c.excerpt,
      meta: [c.relatedEventTitle, c.relatedEventCity, formatDate(c.publishedAt)]
        .filter(Boolean)
        .join(" · "),
      authorName: c.authorName,
      photographerName: c.photographerName,
      coverCredit: c.coverCredit,
      photosAvailable: c.photosAvailable,
      eventHref: c.relatedEventSlug ? `/eventos/${c.relatedEventSlug}` : null,
    })) ?? [];

  const fromArticles =
    articles
      ?.slice(0, 5)
      .map((article) => {
        const card = toArticleCardProps(article, { forceEditorialStock: false });
        if (!card.imageUrl) return null;
        return {
          href: card.href,
          title: card.title,
          imageUrl: card.imageUrl,
          excerpt: null as string | null,
          meta: null as string | null,
          authorName: null as string | null,
          photographerName: null as string | null,
          coverCredit: null as string | null,
          photosAvailable: false,
          eventHref: null as string | null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x)) ?? [];

  const items = (fromDist.length > 0 ? fromDist : fromArticles).filter((i) =>
    Boolean(i.imageUrl || i.title),
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="home-coverages-heading">
      <div className="mb-8 flex flex-col gap-3 md:mb-10 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="is-eyebrow">Mirada fotográfica</p>
          <h2
            id="home-coverages-heading"
            className="is-h2 mt-3 text-2xl md:text-3xl lg:text-4xl"
          >
            Últimas coberturas
          </h2>
        </div>
        <Link href="/noticias" className="is-btn is-btn-ghost min-h-11 self-start">
          Ver más coberturas
        </Link>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.slice(0, 6).map((item) => (
          <article key={item.href} className="group">
            <Link href={item.href} className="block">
              <div className="relative">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="aspect-[16/11] w-full object-cover transition-[transform] duration-300 group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                ) : (
                  <div className="aspect-[16/11] bg-[var(--is-graphite-900)]" />
                )}
                {item.photosAvailable ? (
                  <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Fotos disponibles
                  </span>
                ) : null}
              </div>
              <div className="mt-4 space-y-2">
                {item.meta ? (
                  <p className="text-xs uppercase tracking-[0.12em] text-[var(--is-muted)]">
                    {item.meta}
                  </p>
                ) : null}
                <h3 className="is-h4 text-lg group-hover:text-[var(--is-accent)]">
                  {item.title}
                </h3>
                {item.excerpt ? (
                  <p className="line-clamp-2 text-sm text-[var(--is-text-secondary)]">
                    {item.excerpt}
                  </p>
                ) : null}
                {item.coverCredit || item.photographerName ? (
                  <p className="text-xs text-[var(--is-muted)]">
                    {item.coverCredit || `Foto: ${item.photographerName}`}
                  </p>
                ) : item.authorName ? (
                  <p className="text-xs text-[var(--is-muted)]">{item.authorName}</p>
                ) : null}
              </div>
            </Link>
            {item.eventHref ? (
              <Link
                href={item.eventHref}
                className="mt-2 inline-block text-xs font-medium text-[var(--is-accent)] hover:underline"
              >
                Ver evento
              </Link>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
