import { cache } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { blogPath, getBlogPost, listBlogPosts, loadPublicBlog, mapPublicPostTags, postPath } from "@/lib/blog/public";
import { blogViewsPath, formatBlogDate, readingMinutes, toBlogCard } from "@/lib/blog/public-format";
import { buildBlogPostMetadata, serializeBlogPostJsonLd } from "@/lib/blog/public-seo";
import { BlogArticleBody } from "@/components/website/blog/blog-article-body";
import { BlogButtonLink, BlogFrame } from "@/components/website/blog/blog-frame";
import { BLOG_HEADING_STYLE, BLOG_SOFT_BG, BLOG_SOFT_BORDER, BlogPostGrid } from "@/components/website/blog/blog-post-card";
import { BlogViewTracker } from "@/components/website/blog/blog-view-tracker";

type Props = { params: Promise<{ workspaceSlug: string; slug: string }> };

/** La metadata y la página piden el mismo artículo: una sola consulta por request. */
const cargar = cache(async (workspaceSlug: string, postSlug: string) => {
  const blog = await loadPublicBlog(workspaceSlug);
  if (!blog) return null;
  const post = await getBlogPost(blog, postSlug);
  return post ? { blog, post } : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug, slug } = await params;
  const data = await cargar(workspaceSlug, slug);
  if (!data) return { title: "Artículo no encontrado", robots: { index: false, follow: false } };
  return buildBlogPostMetadata(data.blog, data.post);
}

export default async function PublicBlogPostPage({ params }: Props) {
  const { workspaceSlug, slug } = await params;
  const data = await cargar(workspaceSlug, slug);
  if (!data) notFound();
  const { blog, post } = data;

  const tags = mapPublicPostTags(post);
  const related = await listBlogPosts(blog, { limit: 3, excludeId: post.id });
  const href = blogPath(blog.slug);
  const fecha = formatBlogDate(post.publishedAt);
  const minutos = readingMinutes(post.readingTimeMin, post.contentHtml);

  return (
    <BlogFrame>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeBlogPostJsonLd(blog, post) }} />
      <BlogViewTracker endpoint={blogViewsPath(blog.slug)} slug={post.slug} />

      <article>
        <header className="mx-auto max-w-3xl space-y-5 px-4 pt-10 sm:px-6 sm:pt-14">
          <Link href={href} className="inline-flex items-center gap-1 text-sm" style={{ color: "var(--wsite-text)", opacity: 0.7 }}>
            ← Blog
          </Link>

          {post.category ? (
            <p>
              <Link
                href={`${href}/categoria/${post.category.slug}`}
                className="text-xs font-semibold uppercase tracking-[0.18em] hover:underline"
                style={{ color: "var(--wsite-primary)" }}
              >
                {post.category.name}
              </Link>
            </p>
          ) : null}

          <h1 className="text-[2rem] leading-[1.15] break-words sm:text-5xl" style={BLOG_HEADING_STYLE}>
            {post.title}
          </h1>

          {post.excerpt ? (
            <p className="text-lg leading-relaxed sm:text-xl" style={{ opacity: 0.75 }}>
              {post.excerpt}
            </p>
          ) : null}

          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" style={{ opacity: 0.65 }}>
            {post.author ? (
              <>
                <span>Por {post.author.name}</span>
                <span aria-hidden>·</span>
              </>
            ) : null}
            {fecha && post.publishedAt ? (
              <>
                <time dateTime={post.publishedAt.toISOString()}>{fecha}</time>
                <span aria-hidden>·</span>
              </>
            ) : null}
            <span>{minutos} min de lectura</span>
          </p>
        </header>

        {post.heroImageUrl ? (
          <div className="mx-auto mt-8 max-w-5xl px-0 sm:mt-10 sm:px-6">
            <div className="overflow-hidden sm:rounded-3xl" style={{ backgroundColor: BLOG_SOFT_BG }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- las portadas viven en R2 */}
              <img src={post.heroImageUrl} alt={post.title} className="aspect-[16/9] w-full object-cover" fetchPriority="high" />
            </div>
          </div>
        ) : null}

        <div className="mx-auto max-w-[42rem] px-4 pt-10 pb-12 sm:px-6 sm:pt-12">
          <BlogArticleBody html={post.contentHtml} />

          {tags.length > 0 ? (
            <ul className="mt-12 flex flex-wrap gap-2 border-t pt-8" style={{ borderColor: BLOG_SOFT_BORDER }} aria-label="Etiquetas">
              {tags.map((tag) => (
                <li key={tag.id}>
                  <Link
                    href={`${href}/tag/${tag.slug}`}
                    className="inline-flex min-h-9 items-center px-3.5 text-sm"
                    style={{ borderRadius: "var(--wsite-button-radius)", border: `1px solid ${BLOG_SOFT_BORDER}` }}
                  >
                    #{tag.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </article>

      {related.length > 0 ? (
        <section aria-labelledby="blog-mas-articulos" className="border-t" style={{ borderColor: BLOG_SOFT_BORDER }}>
          <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6 sm:py-16">
            <h2 id="blog-mas-articulos" className="text-2xl sm:text-3xl" style={BLOG_HEADING_STYLE}>
              Más artículos
            </h2>
            <BlogPostGrid posts={related.map((p) => toBlogCard(p, postPath(blog.slug, p.slug)))} />
          </div>
        </section>
      ) : null}

      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <BlogButtonLink href={href}>← Volver al blog</BlogButtonLink>
      </div>
    </BlogFrame>
  );
}
