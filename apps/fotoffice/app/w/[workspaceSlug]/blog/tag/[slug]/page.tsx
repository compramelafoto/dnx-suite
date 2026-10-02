import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { blogPath, getBlogTag, loadPublicBlog, postPath } from "@/lib/blog/public";
import { toBlogCard } from "@/lib/blog/public-format";
import { buildBlogMetadata } from "@/lib/blog/public-seo";
import { BlogButtonLink, BlogEmpty, BlogFrame, BlogListHeader } from "@/components/website/blog/blog-frame";
import { BlogPostGrid } from "@/components/website/blog/blog-post-card";

type Props = { params: Promise<{ workspaceSlug: string; slug: string }> };

/** La metadata y la página piden lo mismo: una sola consulta por request. */
const cargar = cache(async (workspaceSlug: string, tagSlug: string) => {
  const blog = await loadPublicBlog(workspaceSlug);
  if (!blog) return null;
  const result = await getBlogTag(blog, tagSlug);
  return result ? { blog, ...result } : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug, slug } = await params;
  const data = await cargar(workspaceSlug, slug);
  if (!data) return { title: "Etiqueta no encontrada" };
  const { blog, tag } = data;
  return buildBlogMetadata(blog, {
    title: `${tag.name} · Blog`,
    description: `Artículos de ${blog.nombre} etiquetados como ${tag.name}.`,
    path: `${blogPath(blog.slug)}/tag/${tag.slug}`,
    noIndex: data.posts.length === 0,
  });
}

export default async function PublicBlogTagPage({ params }: Props) {
  const { workspaceSlug, slug } = await params;
  const data = await cargar(workspaceSlug, slug);
  if (!data) notFound();
  const { blog, tag, posts } = data;

  return (
    <BlogFrame>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-12 sm:px-6 sm:py-16 md:space-y-14">
        <BlogListHeader eyebrow="Etiqueta" title={`#${tag.name}`} />

        {posts.length > 0 ? (
          <BlogPostGrid posts={posts.map((p) => toBlogCard(p, postPath(blog.slug, p.slug)))} />
        ) : (
          <BlogEmpty>Todavía no hay artículos con esta etiqueta.</BlogEmpty>
        )}

        <div>
          <BlogButtonLink href={blogPath(blog.slug)}>← Volver al blog</BlogButtonLink>
        </div>
      </div>
    </BlogFrame>
  );
}
