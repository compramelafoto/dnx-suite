import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPostGrid } from "@/components/blog/BlogPostGrid";
import { PageHero } from "@/components/content/PageHero";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { siteConfig } from "@/config/site";
import { buildBlogTagMetadata } from "@/lib/content/blog-metadata";
import { blogHomePath } from "@/lib/content/content-site-config";
import { getClickatonPostsByTagSlug } from "@/lib/content/public-queries";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getClickatonPostsByTagSlug(slug);
  if (!result) {
    return { title: `Tag no encontrado — ${siteConfig.name}` };
  }
  return buildBlogTagMetadata(result.tag);
}

export default async function BlogTagPage({ params }: Props) {
  const { slug } = await params;
  const result = await getClickatonPostsByTagSlug(slug);
  if (!result) notFound();

  const { tag, posts } = result;

  return (
    <>
      <SimpleBreadcrumb
        items={[
          { label: "Inicio", href: "/" },
          { label: "Blog", href: blogHomePath() },
          { label: tag.name },
        ]}
      />
      <PageHero
        eyebrow="Tag"
        title={tag.name}
        description={`Notas del blog de Clickatón etiquetadas como ${tag.name}.`}
        actions={
          <Button href={blogHomePath()} variant="secondary">
            Ver todo el blog
          </Button>
        }
      />

      <Section aria-label={`Notas etiquetadas ${tag.name}`}>
        <Container width="wide">
          <BlogPostGrid
            posts={posts}
            emptyMessage="Todavía no hay notas publicadas con este tag."
          />
        </Container>
      </Section>
    </>
  );
}
