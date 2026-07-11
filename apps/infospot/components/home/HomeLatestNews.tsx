import {
  ArticleCard,
  ArticleCardCompact,
  ArticleCardHorizontal,
} from "@/components/editorial/article-cards";
import { SectionHeader } from "@/components/editorial/SectionHeader";
import type { ArticleWithRelations } from "@/lib/articles";

type Props = {
  articles: ArticleWithRelations[];
};

/** Últimas con ritmo editorial: lead + horizontal + compactas. */
export function HomeLatestNews({ articles }: Props) {
  if (articles.length === 0) return null;

  const [lead, second, ...rest] = articles;

  return (
    <section aria-labelledby="home-latest-heading">
      <SectionHeader
        id="home-latest-heading"
        title="Últimas noticias"
        eyebrow="Redacción"
        description="Lo que la mesa de edición eligió para esta jornada."
        actionHref="/noticias"
        actionLabel="Ver todas"
      />

      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        {lead ? (
          <div className="lg:col-span-7">
            <ArticleCard article={lead} />
          </div>
        ) : null}

        <div className="flex flex-col gap-6 lg:col-span-5">
          {second ? <ArticleCardHorizontal article={second} /> : null}
          {rest.length > 0 ? (
            <div className="border-t border-[var(--is-border)] pt-2">
              {rest.map((article) => (
                <ArticleCardCompact key={article.id} article={article} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
