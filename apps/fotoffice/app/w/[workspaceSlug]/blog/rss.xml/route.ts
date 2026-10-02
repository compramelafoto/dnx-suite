import { blogPath, listBlogPosts, loadPublicBlog, postPath } from "@/lib/blog/public";
import { buildBlogRssXml } from "@/lib/blog/public-format";
import { blogAbsoluteUrl, blogDefaultDescription, blogRssPath } from "@/lib/blog/public-seo";

/**
 * El RSS del blog de la institución: los últimos 30 artículos, en el mismo orden que el listado.
 *
 * Vive como carpeta `rss.xml` al lado de `[slug]`: un segmento fijo gana sobre el dinámico, así
 * que un artículo no puede llamarse "rss.xml" — nadie lo haría, y el slug no admite puntos.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  const blog = await loadPublicBlog(workspaceSlug);
  if (!blog) return new Response("No encontrado", { status: 404 });

  const posts = await listBlogPosts(blog, { limit: 30 });
  const xml = buildBlogRssXml({
    title: `Blog de ${blog.nombre}`,
    description: blogDefaultDescription(blog),
    siteUrl: blogAbsoluteUrl(blogPath(blog.slug)),
    feedUrl: blogAbsoluteUrl(blogRssPath(blog.slug)),
    items: posts.map((p) => ({
      title: p.title,
      url: blogAbsoluteUrl(postPath(blog.slug, p.slug)),
      description: p.excerpt,
      publishedAt: p.publishedAt,
      category: p.category?.name ?? null,
    })),
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // Los lectores de RSS consultan seguido: media hora de CDN alcanza y descarga la base.
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
