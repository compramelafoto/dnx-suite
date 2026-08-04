import Link from "next/link";
import type { Metadata } from "next";
import { BlogPostCard } from "@/components/blog/BlogPostCard";
import { BlogPostGrid } from "@/components/blog/BlogPostGrid";
import { PageHero } from "@/components/content/PageHero";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Button } from "@/components/ui/Button";
import { routes } from "@/config/navigation";
import { buildBlogHomeMetadata } from "@/lib/content/blog-metadata";
import { blogCategoryPath } from "@/lib/content/content-site-config";
import {
  getAllClickatonPublishedPosts,
  getClickatonFeaturedPost,
  listClickatonBlogCategories,
} from "@/lib/content/public-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildBlogHomeMetadata();

export default async function BlogHomePage() {
  const [featured, posts, categories] = await Promise.all([
    getClickatonFeaturedPost(),
    getAllClickatonPublishedPosts(),
    listClickatonBlogCategories(),
  ]);

  const listing = posts.filter((post) => post.id !== featured?.id);
  const categoryChips = categories.filter((category) => category._count.posts > 0);

  return (
    <>
      <SimpleBreadcrumb current="Blog" />
      <PageHero
        eyebrow="Blog"
        title="Notas de Clickatón"
        description="Guías para participar, historias de sedes y todo lo que aprendemos organizando maratones fotográficas."
        actions={<Button href={routes.marathons}>Ver maratones</Button>}
      />

      {categoryChips.length > 0 ? (
        <Section tone="raised" aria-label="Categorías del blog">
          <Container>
            <ul className="flex flex-wrap gap-3">
              {categoryChips.map((category) => (
                <li key={category.id}>
                  <Link
                    href={blogCategoryPath(category.slug)}
                    className="inline-flex min-h-11 items-center rounded-full border border-ck-border px-5 text-sm text-ck-text-secondary transition-colors hover:border-ck-yellow hover:text-ck-yellow"
                  >
                    {category.name}
                    <span className="ml-2 text-ck-text-muted">{category._count.posts}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {featured ? (
        <Section aria-labelledby="blog-featured-title">
          <Container>
            <SectionHeader
              eyebrow="Destacada"
              title="Lo que estamos contando"
              titleId="blog-featured-title"
            />
            <div className="mt-[var(--ck-stack-subtitle-to-content)]">
              <BlogPostCard post={featured} featured />
            </div>
          </Container>
        </Section>
      ) : null}

      <Section tone={featured ? "raised" : "base"} aria-labelledby="blog-listing-title">
        <Container width="wide">
          <SectionHeader
            eyebrow="Todas las notas"
            title="Últimas publicaciones"
            titleId="blog-listing-title"
          />
          <div className="mt-[var(--ck-stack-subtitle-to-content)]">
            <BlogPostGrid
              posts={listing}
              emptyMessage="Estamos preparando las primeras notas del blog. Volvé pronto."
            />
          </div>
        </Container>
      </Section>
    </>
  );
}
