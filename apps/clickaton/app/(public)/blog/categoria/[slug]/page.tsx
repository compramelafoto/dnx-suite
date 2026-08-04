import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPostGrid } from "@/components/blog/BlogPostGrid";
import { PageHero } from "@/components/content/PageHero";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { siteConfig } from "@/config/site";
import { buildBlogCategoryMetadata } from "@/lib/content/blog-metadata";
import { blogHomePath } from "@/lib/content/content-site-config";
import { getClickatonPostsByCategorySlug } from "@/lib/content/public-queries";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getClickatonPostsByCategorySlug(slug);
  if (!result) {
    return { title: `Categoría no encontrada — ${siteConfig.name}` };
  }
  return buildBlogCategoryMetadata(result.category);
}

export default async function BlogCategoryPage({ params }: Props) {
  const { slug } = await params;
  const result = await getClickatonPostsByCategorySlug(slug);
  if (!result) notFound();

  const { category, posts } = result;

  return (
    <>
      <SimpleBreadcrumb
        items={[
          { label: "Inicio", href: "/" },
          { label: "Blog", href: blogHomePath() },
          { label: category.name },
        ]}
      />
      <PageHero
        eyebrow="Categoría"
        title={category.name}
        description={
          category.description?.trim() ||
          `Notas del blog de Clickatón agrupadas en ${category.name.toLowerCase()}.`
        }
        actions={
          <Button href={blogHomePath()} variant="secondary">
            Ver todo el blog
          </Button>
        }
      />

      <Section aria-label={`Notas de ${category.name}`}>
        <Container width="wide">
          <BlogPostGrid
            posts={posts}
            emptyMessage="Todavía no hay notas publicadas en esta categoría."
          />
        </Container>
      </Section>
    </>
  );
}
