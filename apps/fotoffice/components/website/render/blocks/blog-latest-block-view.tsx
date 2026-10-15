import Link from "next/link";
import type { BlogLatestBlockConfig } from "@/lib/website/blocks";
import type { BlogCardItem, WebsiteDynamicData } from "@/lib/website/dynamic-data";
import { BLOG_HEADING_STYLE, BlogPostGrid } from "@/components/website/blog/blog-post-card";

/**
 * Tarjetas de ejemplo para la vista previa del builder: ahí el renderer corre en el navegador y
 * no recibe los artículos (ver `dynamic-data.ts`). Muestran la forma, no contenido real — por
 * eso el texto lo dice.
 */
function ejemplos(count: number): BlogCardItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: -(i + 1),
    href: "#",
    title: "Así se va a ver el título de un artículo",
    excerpt: "Acá aparecen tus últimos artículos publicados, con su portada, su categoría y el comienzo del texto.",
    imageUrl: null,
    categoryName: "Categoría",
    dateLabel: "28 de diciembre de 2025",
    dateIso: null,
  }));
}

/**
 * "Últimos artículos": las N tarjetas más recientes del blog y un enlace al blog entero.
 *
 * Con datos (`data.blogLatest`, sitio público) y sin artículos, el bloque no se dibuja: una
 * sección vacía en la portada se ve rota. Sin datos (vista previa del builder) muestra ejemplos.
 */
export function BlogLatestBlockView({ config, data }: { config: BlogLatestBlockConfig; data?: WebsiteDynamicData }) {
  const real = data?.blogLatest;
  if (real && real.posts.length === 0) return null;

  const posts = real ? real.posts.slice(0, config.count) : ejemplos(config.count);
  const blogHref = real?.blogHref ?? "#";

  return (
    <section className="px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-2xl sm:text-3xl" style={BLOG_HEADING_STYLE}>
            {config.title?.trim() || "Últimos artículos"}
          </h2>
          <Link href={blogHref} className="text-sm font-semibold" style={{ color: "var(--wsite-primary)" }}>
            Ver todos los artículos →
          </Link>
        </div>
        <BlogPostGrid posts={posts} showExcerpt={config.showExcerpt} />
      </div>
    </section>
  );
}
