import Link from "next/link";
import type { CSSProperties } from "react";
import type { BlogCardItem } from "@/lib/website/dynamic-data";

/**
 * La tarjeta de un artículo. La comparten el blog público y el bloque "Últimos artículos" del
 * constructor — y como ese bloque también se dibuja en la vista previa del builder (cliente),
 * esta tarjeta no consulta nada ni usa hooks: recibe todo masticado (`BlogCardItem`).
 *
 * Los colores salen de las variables del sitio (`--wsite-*`) para que el blog se vea de la
 * institución y no de FOTOFFICE. Los bordes y fondos sutiles se derivan del color del texto con
 * `color-mix`, así funcionan igual sobre un sitio claro o uno oscuro.
 */

export const BLOG_HEADING_STYLE: CSSProperties = {
  color: "var(--wsite-text)",
  fontFamily: "var(--wsite-heading-font)",
  fontWeight: "var(--wsite-heading-weight)",
  letterSpacing: "var(--wsite-letter-spacing)",
};

export const BLOG_SOFT_BORDER = "color-mix(in srgb, var(--wsite-text) 12%, transparent)";
export const BLOG_SOFT_BG = "color-mix(in srgb, var(--wsite-text) 5%, transparent)";

function Portada({ src, alt, className }: { src: string | null; alt: string; className: string }) {
  if (!src) {
    // Sin portada, un bloque de color de la institución: la grilla no queda con huecos.
    return (
      <div
        aria-hidden
        className={className}
        style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--wsite-primary) 85%, transparent), color-mix(in srgb, var(--wsite-accent) 70%, transparent))",
        }}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- las portadas viven en R2
    <img src={src} alt={alt} loading="lazy" className={`${className} object-cover transition-transform duration-500 group-hover:scale-[1.03]`} />
  );
}

function Meta({ post }: { post: BlogCardItem }) {
  if (!post.categoryName && !post.dateLabel) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {post.categoryName ? (
        <span className="font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--wsite-primary)" }}>
          {post.categoryName}
        </span>
      ) : null}
      {post.categoryName && post.dateLabel ? <span aria-hidden style={{ opacity: 0.35 }}>·</span> : null}
      {post.dateLabel ? (
        <time dateTime={post.dateIso ?? undefined} style={{ color: "var(--wsite-text)", opacity: 0.6 }}>
          {post.dateLabel}
        </time>
      ) : null}
    </p>
  );
}

export function BlogPostCard({ post, showExcerpt = true }: { post: BlogCardItem; showExcerpt?: boolean }) {
  return (
    <article className="h-full">
      <Link href={post.href} className="group flex h-full flex-col gap-4">
        <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: BLOG_SOFT_BG }}>
          <Portada src={post.imageUrl} alt={post.title} className="aspect-[3/2] w-full" />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Meta post={post} />
          <h3 className="text-xl leading-snug break-words group-hover:underline underline-offset-4" style={BLOG_HEADING_STYLE}>
            {post.title}
          </h3>
          {showExcerpt && post.excerpt ? (
            <p className="line-clamp-3 text-[0.95rem] leading-relaxed" style={{ color: "var(--wsite-text)", opacity: 0.75 }}>
              {post.excerpt}
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}

/** El artículo grande de arriba del listado: imagen a la izquierda en escritorio, arriba en el teléfono. */
export function BlogFeaturedCard({ post }: { post: BlogCardItem }) {
  return (
    <article>
      <Link href={post.href} className="group grid items-center gap-6 md:grid-cols-[1.35fr_1fr] md:gap-10">
        <div className="overflow-hidden rounded-3xl" style={{ backgroundColor: BLOG_SOFT_BG }}>
          <Portada src={post.imageUrl} alt={post.title} className="aspect-[16/10] w-full" />
        </div>
        <div className="flex flex-col gap-3">
          <Meta post={post} />
          <h2
            className="text-[1.75rem] leading-tight break-words group-hover:underline underline-offset-4 sm:text-4xl"
            style={BLOG_HEADING_STYLE}
          >
            {post.title}
          </h2>
          {post.excerpt ? (
            <p className="line-clamp-4 text-base leading-relaxed sm:text-lg" style={{ color: "var(--wsite-text)", opacity: 0.75 }}>
              {post.excerpt}
            </p>
          ) : null}
          <span className="mt-1 text-sm font-semibold" style={{ color: "var(--wsite-primary)" }}>
            Leer artículo →
          </span>
        </div>
      </Link>
    </article>
  );
}

export function BlogPostGrid({ posts, showExcerpt = true }: { posts: BlogCardItem[]; showExcerpt?: boolean }) {
  return (
    <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <li key={post.id}>
          <BlogPostCard post={post} showExcerpt={showExcerpt} />
        </li>
      ))}
    </ul>
  );
}
