import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogArticleBody } from "@/components/blog/BlogArticleBody";
import { BlogMarathonCta } from "@/components/blog/BlogMarathonCta";
import { BlogPostGrid } from "@/components/blog/BlogPostGrid";
import { BlogViewTracker } from "@/components/blog/BlogViewTracker";
import { formatBlogDate } from "@/components/blog/blog-format";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { siteConfig } from "@/config/site";
import {
  buildBlogArticleMetadata,
  serializeBlogArticleJsonLd,
} from "@/lib/content/blog-metadata";
import {
  blogCategoryPath,
  blogHomePath,
  blogTagPath,
} from "@/lib/content/content-site-config";
import {
  getClickatonPostBySlug,
  listClickatonPublishedPosts,
  mapPublicPostTags,
} from "@/lib/content/public-queries";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getClickatonPostBySlug(slug);
  if (!post) {
    return { title: `Nota no encontrada — ${siteConfig.name}` };
  }
  return buildBlogArticleMetadata(post);
}

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const post = await getClickatonPostBySlug(slug);
  if (!post) notFound();

  const tags = mapPublicPostTags(post);
  const related = await listClickatonPublishedPosts({ limit: 3, excludeId: post.id });
  const jsonLd = serializeBlogArticleJsonLd({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    seoDescription: post.seoDescription,
    publishedAt: post.publishedAt,
    updatedAt: post.lastReviewedAt || post.updatedAt,
    heroImageUrl: post.heroImageUrl,
    ogImageUrl: post.ogImageUrl,
    author: post.author ? { name: post.author.name, slug: post.author.slug } : null,
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <BlogViewTracker slug={post.slug} />

      <SimpleBreadcrumb
        items={[
          { label: "Inicio", href: "/" },
          { label: "Blog", href: blogHomePath() },
          { label: post.title },
        ]}
      />

      <Section tone="raised" aria-labelledby="blog-article-title">
        <Container width="narrow">
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.12em] text-ck-text-muted">
            {post.category ? (
              <Link
                href={blogCategoryPath(post.category.slug)}
                className="text-ck-yellow hover:underline"
              >
                {post.category.name}
              </Link>
            ) : null}
            <span>{formatBlogDate(post.publishedAt)}</span>
            {post.readingTimeMin ? <span>{post.readingTimeMin} min de lectura</span> : null}
          </div>

          <h1
            id="blog-article-title"
            className="ck-display-lg mt-[var(--ck-stack-title-to-subtitle)] break-words text-ck-text [overflow-wrap:anywhere]"
          >
            {post.title}
          </h1>

          {post.excerpt ? (
            <p className="ck-body-lg mt-6 max-w-prose text-ck-text-secondary">{post.excerpt}</p>
          ) : null}

          {post.author ? (
            <p className="mt-6 text-sm text-ck-text-muted">
              Por <span className="text-ck-text">{post.author.name}</span>
            </p>
          ) : null}
        </Container>
      </Section>

      {post.heroImageUrl ? (
        <Section flush aria-hidden>
          <Container width="narrow">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[var(--ck-radius-card)] bg-ck-surface-strong">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.heroImageUrl}
                alt={post.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </Container>
        </Section>
      ) : null}

      <Section aria-label="Contenido de la nota">
        <Container width="narrow" className="space-y-16">
          <BlogArticleBody html={post.contentHtml} />

          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-3 border-t border-ck-border pt-8">
              {tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={blogTagPath(tag.slug)}
                  className="inline-flex min-h-10 items-center rounded-full border border-ck-border px-4 text-sm text-ck-text-secondary transition-colors hover:border-ck-yellow hover:text-ck-yellow"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          ) : null}

          <BlogMarathonCta />
        </Container>
      </Section>

      {related.length > 0 ? (
        <Section tone="raised" aria-labelledby="blog-related-title">
          <Container width="wide">
            <SectionHeader
              eyebrow="Seguí leyendo"
              title="Otras notas del blog"
              titleId="blog-related-title"
            />
            <div className="mt-[var(--ck-stack-subtitle-to-content)]">
              <BlogPostGrid posts={related} />
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
