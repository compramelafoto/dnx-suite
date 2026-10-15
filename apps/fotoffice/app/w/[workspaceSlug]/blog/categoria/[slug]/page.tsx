import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { blogPath, getBlogCategory, listBlogCategories, loadPublicBlog, postPath } from "@/lib/blog/public";
import { buildCategoryChips, toBlogCard } from "@/lib/blog/public-format";
import { buildBlogMetadata } from "@/lib/blog/public-seo";
import { BlogButtonLink, BlogChips, BlogEmpty, BlogFrame, BlogListHeader } from "@/components/website/blog/blog-frame";
import { BlogPostGrid } from "@/components/website/blog/blog-post-card";

type Props = { params: Promise<{ workspaceSlug: string; slug: string }> };

/** La metadata y la página piden lo mismo: una sola consulta por request. */
const cargar = cache(async (workspaceSlug: string, categorySlug: string) => {
  const blog = await loadPublicBlog(workspaceSlug);
  if (!blog) return null;
  const result = await getBlogCategory(blog, categorySlug);
  return result ? { blog, ...result } : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug, slug } = await params;
  const data = await cargar(workspaceSlug, slug);
  if (!data) return { title: "Categoría no encontrada" };
  const { blog, category } = data;
  return buildBlogMetadata(blog, {
    title: `${category.name} · Blog`,
    description: category.description?.trim() || `Artículos de ${blog.nombre} sobre ${category.name}.`,
    path: `${blogPath(blog.slug)}/categoria/${category.slug}`,
    // Una categoría sin artículos indexables es una página vacía: no tiene sentido indexarla.
    noIndex: data.posts.length === 0,
  });
}

export default async function PublicBlogCategoryPage({ params }: Props) {
  const { workspaceSlug, slug } = await params;
  const data = await cargar(workspaceSlug, slug);
  if (!data) notFound();
  const { blog, category, posts } = data;

  const categories = await listBlogCategories(blog);
  const href = blogPath(blog.slug);

  return (
    <BlogFrame>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-12 sm:px-6 sm:py-16 md:space-y-14">
        <div className="space-y-6">
          <BlogListHeader eyebrow="Categoría" title={category.name} description={category.description} />
          <BlogChips label="Categorías del blog" chips={buildCategoryChips(href, categories, category.slug)} />
        </div>

        {posts.length > 0 ? (
          <BlogPostGrid posts={posts.map((p) => toBlogCard(p, postPath(blog.slug, p.slug)))} />
        ) : (
          <BlogEmpty>Todavía no hay artículos en esta categoría.</BlogEmpty>
        )}

        <div>
          <BlogButtonLink href={href}>← Volver al blog</BlogButtonLink>
        </div>
      </div>
    </BlogFrame>
  );
}
