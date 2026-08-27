import {
  ArticleCard,
  ArticleCardFeatured,
} from "@/components/editorial/article-cards";
import { CategoryBadge } from "@/components/editorial/category-badge";
import { EmptyState } from "@/components/editorial/empty-state";
import { Pagination } from "@/components/editorial/Pagination";
import { EditorialContainer, Section } from "@/components/foundations";
import type { ArticleWithRelations } from "@/lib/articles";

export const NOTICIAS_PAGE_SIZE = 12;

type CategoryChip = {
  id: string;
  name: string;
  slug: string;
};

type Props = {
  articles: ArticleWithRelations[];
  categories: CategoryChip[];
  page: number;
  hasNext: boolean;
  /** Si el HERO de portada ya trae el H1, el listado usa H2. */
  showPageHeader: boolean;
};

export function NoticiasIndex({
  articles,
  categories,
  page,
  hasNext,
  showPageHeader,
}: Props) {
  const featured = page === 1 ? (articles[0] ?? null) : null;
  const rest = featured ? articles.slice(1) : articles;
  const Heading = showPageHeader ? "h1" : "h2";

  return (
    <Section spacing="lg">
      <EditorialContainer>
        {showPageHeader ? (
          <header className="max-w-2xl">
            <p className="is-eyebrow">Agenda editorial</p>
            <Heading className="is-display mt-3 text-4xl md:text-5xl">Noticias</Heading>
            <p className="is-dek mt-4">
              Cobertura de eventos deportivos, culturales y sociales. Descubrí lo que está
              pasando cerca tuyo.
            </p>
          </header>
        ) : (
          <header className="max-w-2xl">
            <Heading className="is-h2 text-2xl md:text-3xl">Últimas noticias</Heading>
          </header>
        )}

        {categories.length > 0 ? (
          <div className={showPageHeader ? "mt-8 flex flex-wrap gap-2" : "mt-6 flex flex-wrap gap-2"}>
            {categories.map((category) => (
              <CategoryBadge
                key={category.id}
                name={category.name}
                slug={category.slug}
              />
            ))}
          </div>
        ) : null}

        {articles.length === 0 ? (
          <div className="mt-12">
            <EmptyState
              title="No hay noticias publicadas todavía"
              description="Volvé pronto: la redacción está preparando las primeras coberturas."
            />
          </div>
        ) : (
          <div className="mt-12 space-y-10">
            {featured ? <ArticleCardFeatured article={featured} /> : null}
            {rest.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            ) : null}
            <Pagination page={page} hasNext={hasNext} basePath="/" />
          </div>
        )}
      </EditorialContainer>
    </Section>
  );
}

export function parseNoticiasPage(raw?: string): number {
  return Math.max(1, Number(raw ?? "1") || 1);
}
