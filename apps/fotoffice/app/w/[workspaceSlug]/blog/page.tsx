import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { blogPath, listBlogCategories, listBlogPosts, loadPublicBlog, postPath } from "@/lib/blog/public";
import { buildCategoryChips, splitFeatured, toBlogCard } from "@/lib/blog/public-format";
import { blogDefaultDescription, buildBlogMetadata } from "@/lib/blog/public-seo";
import { BlogChips, BlogEmpty, BlogFrame, BlogListHeader } from "@/components/website/blog/blog-frame";
import { BLOG_SOFT_BORDER, BlogFeaturedCard, BlogPostGrid } from "@/components/website/blog/blog-post-card";

type Props = { params: Promise<{ workspaceSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug } = await params;
  const blog = await loadPublicBlog(workspaceSlug);
  if (!blog) return { title: "Blog" };
  return buildBlogMetadata(blog, {
    title: "Blog",
    description: blogDefaultDescription(blog),
    path: blogPath(blog.slug),
    withRss: true,
  });
}

/**
 * El blog público de la institución. Vive dentro del sitio (`/w/<slug>/blog`), bajo el mismo
 * encabezado y pie que la portada — lo pone el layout de `/w/[workspaceSlug]`.
 *
 * Sin el módulo Sitio web el blog no existe (`loadPublicBlog` devuelve null): es una sección
 * del sitio, no un módulo aparte.
 */
export default async function PublicBlogPage({ params }: Props) {
  const { workspaceSlug } = await params;
  const blog = await loadPublicBlog(workspaceSlug);
  if (!blog) notFound();

  const [posts, categories] = await Promise.all([listBlogPosts(blog), listBlogCategories(blog)]);
  const href = blogPath(blog.slug);
  const cards = posts.map((p) => ({ ...toBlogCard(p, postPath(blog.slug, p.slug)), isFeatured: p.isFeatured }));
  const { featured, rest } = splitFeatured(cards);

  return (
    <BlogFrame>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-12 sm:px-6 sm:py-16 md:space-y-14">
        <div className="space-y-6">
          <BlogListHeader eyebrow="Blog" title={`Blog de ${blog.nombre}`} description={blogDefaultDescription(blog)} />
          <BlogChips label="Categorías del blog" chips={buildCategoryChips(href, categories, null)} />
        </div>

        {featured ? (
          <>
            <BlogFeaturedCard post={featured} />
            {rest.length > 0 ? (
              <section aria-label="Más artículos" className="space-y-8 border-t pt-10 md:pt-14" style={{ borderColor: BLOG_SOFT_BORDER }}>
                <BlogPostGrid posts={rest} />
              </section>
            ) : null}
          </>
        ) : (
          <BlogEmpty>Todavía no hay artículos publicados.</BlogEmpty>
        )}
      </div>
    </BlogFrame>
  );
}
