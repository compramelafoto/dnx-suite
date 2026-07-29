import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import BlogArticleBody from "@/components/blog/BlogArticleBody";
import BlogNewsletterForm from "@/components/blog/BlogNewsletterForm";
import BlogPageShell from "@/components/blog/BlogPageShell";
import BlogTypeBadge from "@/components/blog/BlogTypeBadge";
import {
  formatBlogAdminDate,
  formatBlogAdminDateTime,
} from "@/components/blog/admin/blog-admin-constants";
import { resolveBlogPostThumbnailUrl } from "@/lib/blog/blog-post-images";
import { parseBlogSeoGoal } from "@/lib/blog/blog-seo-goal";
import { serializeBlogArticleJsonLd, serializeBlogBreadcrumbJsonLd, serializeBlogFaqPageJsonLd } from "@/lib/blog/blog-json-ld";
import { buildBlogArticleMetadata } from "@/lib/blog/blog-metadata";
import { getBlogVisitorKeyFromHeaders } from "@/lib/blog/blog-visitor-server";
import { incrementBlogPostUniqueViewCount } from "@/lib/blog/increment-view-count";
import { getPublishedPostBySlug, mapPublicPostTags } from "@/lib/blog/public-queries";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await Promise.resolve(params);
  const post = await getPublishedPostBySlug(slug);
  if (!post) {
    return { title: "Artículo no encontrado | ComprameLaFoto" };
  }
  return buildBlogArticleMetadata({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
    ogImageUrl: post.ogImageUrl,
    heroImageUrl: post.heroImageUrl,
    canonicalUrl: post.canonicalUrl,
    noIndex: post.noIndex,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    lastReviewedAt: post.lastReviewedAt,
  });
}

export default async function BlogArticlePage({ params }: PageProps) {
  const { slug } = await Promise.resolve(params);
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  const visitorKey = await getBlogVisitorKeyFromHeaders();
  if (visitorKey) {
    incrementBlogPostUniqueViewCount(post.id, visitorKey);
  }

  const tags = mapPublicPostTags(post);
  const updatedAt = post.lastReviewedAt || post.updatedAt;
  const seoGoal = parseBlogSeoGoal(post.seoGoal);
  const heroImage = resolveBlogPostThumbnailUrl(post);
  const heroAlt = seoGoal?.imagePlan?.hero?.altText?.trim() || post.title;
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
  const breadcrumbJsonLd = serializeBlogBreadcrumbJsonLd({
    title: post.title,
    slug: post.slug,
    category: post.category
      ? { name: post.category.name, slug: post.category.slug }
      : null,
  });
  const faqJsonLd = seoGoal?.faq?.length ? serializeBlogFaqPageJsonLd(seoGoal.faq) : null;

  return (
    <BlogPageShell variant="article" innerClassName="ds-stack-section">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {faqJsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
      ) : null}
      <article className="ds-fill-width">
        <Link href="/blog" className="blog-back-link">
          ← Volver al blog
        </Link>

        <header className="blog-article-header mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <BlogTypeBadge type={post.type} />
            {post.category ? (
              <Link href={`/blog/categoria/${post.category.slug}`} className="blog-link text-sm font-medium">
                {post.category.name}
              </Link>
            ) : null}
          </div>
          <h1 className="blog-article-title">{post.title}</h1>
          {post.excerpt ? <p className="blog-article-excerpt">{post.excerpt}</p> : null}
          <div className="blog-article-meta">
            {post.author ? <span>Por {post.author.name}</span> : null}
            <span>Publicado {formatBlogAdminDate(post.publishedAt)}</span>
            <span>Actualizado {formatBlogAdminDateTime(updatedAt)}</span>
            {post.readingTimeMin ? <span>{post.readingTimeMin} min de lectura</span> : null}
          </div>
          {tags.length > 0 ? (
            <div className="blog-article-tags">
              {tags.map((tag) => (
                <Link key={tag.id} href={`/blog/tag/${tag.slug}`} className="blog-tag-chip">
                  {tag.name}
                </Link>
              ))}
            </div>
          ) : null}
        </header>

        <div className="blog-hero-image">
          <Image
            src={heroImage}
            alt={heroAlt}
            fill
            className="blog-card__media-image"
            priority
            unoptimized
          />
        </div>

        <div className="mt-10 ds-content-container">
          <BlogArticleBody html={post.contentHtml} />
        </div>

        <div className="blog-article-footer">
          <BlogNewsletterForm source="article-footer" compact />
        </div>
      </article>
    </BlogPageShell>
  );
}
