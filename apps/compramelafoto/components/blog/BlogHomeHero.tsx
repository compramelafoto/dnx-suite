import Image from "next/image";
import Link from "next/link";
import BlogTypeBadge from "@/components/blog/BlogTypeBadge";
import { formatBlogAdminDate } from "@/components/blog/admin/blog-admin-constants";
import { resolveBlogPostThumbnailUrl } from "@/lib/blog/blog-post-images";
import type { PublicBlogPostListItem } from "@/lib/blog/public-queries";

type BlogHomeHeroProps = {
  post: PublicBlogPostListItem;
};

export default function BlogHomeHero({ post }: BlogHomeHeroProps) {
  const image = resolveBlogPostThumbnailUrl(post);

  return (
    <section className="blog-card overflow-hidden rounded-2xl">
      <div className="grid gap-0 lg:grid-cols-2">
        <div className="blog-card__hero-media lg:min-h-[360px]">
          <span className="blog-card__media-frame blog-card__media-frame--hero">
            <Image
              src={image}
              alt={post.title}
              fill
              className="blog-card__media-image"
              priority
              unoptimized
            />
          </span>
        </div>
        <div className="flex flex-col justify-center gap-4 p-6 md:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="blog-type-badge blog-type-badge--featured">Destacado</span>
            <BlogTypeBadge type={post.type} />
          </div>
          <h2 className="text-2xl font-semibold leading-tight text-[#1a1a1a] md:text-3xl">
            <Link href={`/blog/${post.slug}`} className="hover:text-[var(--ds-blog-accent)]">
              {post.title}
            </Link>
          </h2>
          {post.excerpt ? (
            <p className="ds-readable-text ds-readable-text--fluid text-base text-[var(--ds-text-secondary)] line-clamp-4">
              {post.excerpt}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--ds-text-muted)]">
            {post.category ? (
              <Link href={`/blog/categoria/${post.category.slug}`} className="blog-link">
                {post.category.name}
              </Link>
            ) : null}
            {post.author ? <span>{post.author.name}</span> : null}
            <span>{formatBlogAdminDate(post.publishedAt)}</span>
            {post.readingTimeMin ? <span>{post.readingTimeMin} min lectura</span> : null}
          </div>
          <div>
            <Link href={`/blog/${post.slug}`} className="blog-cta">
              Leer artículo
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
