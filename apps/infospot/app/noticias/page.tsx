import Link from "next/link";
import type { Metadata } from "next";
import {
  ArticleCard,
  ArticleCardFeatured,
} from "@/components/editorial/article-cards";
import { CategoryBadge } from "@/components/editorial/category-badge";
import { EmptyState } from "@/components/editorial/empty-state";
import { Pagination } from "@/components/editorial/Pagination";
import { EditorialContainer, Section } from "@/components/layout/containers";
import { getCategories, getPublishedArticles } from "@/lib/articles";

export const metadata: Metadata = {
  title: "Noticias",
  description: "Cobertura editorial de lo que está pasando cerca tuyo.",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ page?: string }>;
};

const PAGE_SIZE = 12;

export default async function NoticiasPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const skip = (page - 1) * PAGE_SIZE;
  const [articles, categories] = await Promise.all([
    getPublishedArticles({ take: PAGE_SIZE + 1, skip }),
    getCategories(),
  ]);
  const hasNext = articles.length > PAGE_SIZE;
  const visible = hasNext ? articles.slice(0, PAGE_SIZE) : articles;
  const featured = page === 1 ? visible[0] : null;
  const rest = featured ? visible.slice(1) : visible;

  return (
    <Section spacing="lg">
      <EditorialContainer>
        <header className="max-w-2xl">
          <p className="is-eyebrow">Agenda editorial</p>
          <h1 className="is-display mt-3 text-4xl md:text-5xl">Noticias</h1>
          <p className="is-dek mt-4">
            Cobertura de eventos deportivos, culturales y sociales. Descubrí lo que está
            pasando cerca tuyo.
          </p>
        </header>

        {categories.length > 0 ? (
          <div className="mt-8 flex flex-wrap gap-2">
            {categories.map((category) => (
              <CategoryBadge
                key={category.id}
                name={category.name}
                slug={category.slug}
              />
            ))}
          </div>
        ) : null}

        {visible.length === 0 ? (
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
            <Pagination page={page} hasNext={hasNext} />
          </div>
        )}

        <p className="mt-10 is-meta">
          ¿Buscás una categoría?{" "}
          <Link href="/" className="text-[var(--is-accent)] hover:underline">
            Volver al inicio
          </Link>
        </p>
      </EditorialContainer>
    </Section>
  );
}
