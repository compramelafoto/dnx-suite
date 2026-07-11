import Link from "next/link";
import { toArticleCardProps } from "@/components/editorial/article-cards";
import type { ArticleWithRelations } from "@/lib/articles";

type Props = {
  articles: ArticleWithRelations[];
};

/**
 * Selección editorial — sin métricas simuladas.
 * Hasta tener analytics reales, no se muestra “Lo más leído”.
 */
export function HomeMostRead({ articles }: Props) {
  const ranked = articles.slice(0, 5);
  if (ranked.length === 0) return null;

  return (
    <section aria-labelledby="home-editorial-picks-heading">
      <div className="mb-8 max-w-2xl md:mb-10">
        <p className="is-eyebrow">Lectura</p>
        <h2 id="home-editorial-picks-heading" className="is-h2 mt-3 text-2xl md:text-3xl">
          Selección editorial
        </h2>
        <p className="is-body mt-3">
          Notas destacadas por la redacción. El ranking por lecturas reales llega
          cuando tengamos analytics.
        </p>
      </div>

      <ol className="divide-y divide-[var(--is-border)] border-y border-[var(--is-border)]">
        {ranked.map((article, index) => {
          const card = toArticleCardProps(article, { forceEditorialStock: false });
          return (
            <li key={article.id}>
              <Link
                href={card.href}
                className="group grid grid-cols-[3rem_1fr] items-center gap-4 py-5 md:grid-cols-[4rem_7rem_1fr] md:gap-6"
              >
                <span className="is-display-m !text-[var(--is-orange-500)] tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {card.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.imageUrl}
                    alt={card.imageAlt || card.title}
                    className="hidden aspect-[4/3] w-full object-cover md:block"
                    loading="lazy"
                  />
                ) : (
                  <span className="hidden md:block" aria-hidden />
                )}
                <div className="min-w-0">
                  <h3 className="is-h3 text-lg leading-snug group-hover:text-[var(--is-accent)] md:text-xl">
                    {card.title}
                  </h3>
                  {card.category ? (
                    <p className="is-metadata mt-1">{card.category}</p>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
