import {
  ArticleCard,
  ArticleCardCompact,
  ArticleCardHorizontal,
} from "@/components/editorial/article-cards";
import { SectionHeader } from "@/components/editorial/SectionHeader";
import type { ArticleWithRelations } from "@/lib/articles";

type CategoryBlock = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  articles: ArticleWithRelations[];
};

type Props = {
  blocks: CategoryBlock[];
};

/**
 * Bloques por categoría con composiciones alternadas.
 */
export function HomeCategoryBlocks({ blocks }: Props) {
  if (blocks.length === 0) return null;

  return (
    <>
      {blocks.map((category, index) => {
        const pattern = index % 3;
        const headingId = `home-category-${category.slug}`;
        const [lead, ...rest] = category.articles;

        return (
          <section key={category.id} aria-labelledby={headingId}>
            <SectionHeader
              id={headingId}
              title={category.name}
              description={category.description ?? undefined}
              actionHref={`/categorias/${category.slug}`}
              actionLabel="Ver categoría"
            />

            {pattern === 0 ? (
              <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
                <div className="lg:col-span-7">
                  {lead ? <ArticleCard article={lead} /> : null}
                </div>
                <div className="border-t border-[var(--is-border)] pt-2 lg:col-span-5 lg:border-t-0 lg:pt-0">
                  {rest.map((article) => (
                    <ArticleCardCompact key={article.id} article={article} />
                  ))}
                </div>
              </div>
            ) : null}

            {pattern === 1 ? (
              <div className="space-y-8">
                {lead ? <ArticleCardHorizontal article={lead} /> : null}
                <div className="grid gap-8 md:grid-cols-2">
                  {rest.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              </div>
            ) : null}

            {pattern === 2 ? (
              <div className="grid gap-8 md:grid-cols-3">
                {category.articles.map((article) => (
                  <ArticleCardCompact key={article.id} article={article} />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </>
  );
}
