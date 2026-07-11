import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArticleCard,
  ArticleCardFeatured,
} from "@/components/editorial/article-cards";
import { EmptyState } from "@/components/editorial/empty-state";
import { EditorialContainer, Section } from "@/components/layout/containers";
import { getCategoryBySlug, getPublishedArticles } from "@/lib/articles";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  return {
    title: category?.name ?? "Categoría",
    description: category?.description ?? undefined,
  };
}

export default async function CategoriaPage({ params }: PageProps) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const articles = await getPublishedArticles({ categorySlug: slug, take: 48 });
  const featured = articles[0] ?? null;
  const rest = featured ? articles.slice(1) : [];

  return (
    <Section spacing="lg">
      <EditorialContainer>
        <nav aria-label="Migas" className="is-meta mb-6 flex flex-wrap gap-2">
          <Link href="/noticias" className="hover:text-[var(--is-accent)]">
            Noticias
          </Link>
          <span aria-hidden>/</span>
          <span>{category.name}</span>
        </nav>

        <header className="max-w-2xl">
          <p className="is-eyebrow">Categoría</p>
          <h1 className="is-display mt-3 text-4xl md:text-5xl">{category.name}</h1>
          {category.description ? (
            <p className="is-dek mt-4">{category.description}</p>
          ) : (
            <p className="is-dek mt-4">
              Coberturas y notas de {category.name.toLowerCase()} en Info Spot.
            </p>
          )}
          <p className="is-meta mt-4">
            {articles.length === 1
              ? "1 noticia publicada"
              : `${articles.length} noticias publicadas`}
          </p>
        </header>

        {articles.length === 0 ? (
          <div className="mt-12">
            <EmptyState
              title={`Todavía no hay notas en ${category.name}`}
              description="Cuando se publiquen coberturas de esta categoría, van a aparecer acá."
              actionHref="/noticias"
              actionLabel="Ver todas las noticias"
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
          </div>
        )}
      </EditorialContainer>
    </Section>
  );
}
