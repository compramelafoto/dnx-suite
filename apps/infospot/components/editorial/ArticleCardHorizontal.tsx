import Link from "next/link";
import { cx } from "@/components/foundations/cx";
import { CategoryBadge } from "@/components/editorial/CategoryBadge";
import { ArticleMetadata } from "@/components/editorial/ArticleMetadata";
import type { ArticleCardProps } from "@/components/editorial/types";

/** Horizontal editorial — imagen lateral, sin borde de tarjeta. */
export function ArticleCardHorizontal({
  title,
  excerpt,
  href,
  imageUrl,
  imageAlt = "",
  category,
  categorySlug,
  publishedAt,
  location,
  priority = false,
  className,
}: ArticleCardProps) {
  const src = imageUrl || "/editorial-stock/culture.jpg";

  return (
    <article className={cx("group", className)}>
      <Link
        href={href}
        className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr] sm:gap-5 md:grid-cols-[220px_1fr] md:gap-6"
      >
        <div className="overflow-hidden bg-[var(--is-graphite-100)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={imageAlt || title}
            className="aspect-[16/10] w-full object-cover transition-[transform] duration-[var(--is-duration-300)] group-hover:scale-[1.03] sm:aspect-[4/3] sm:h-full sm:min-h-[8rem]"
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
          />
        </div>
        <div className="flex flex-col justify-center gap-2 py-1">
          <div className="flex flex-wrap items-center gap-2">
            {category ? (
              <CategoryBadge name={category} slug={categorySlug} />
            ) : null}
            <ArticleMetadata date={publishedAt} location={location} />
          </div>
          <h3 className="is-h3 text-base text-wrap break-words sm:text-lg group-hover:text-[var(--is-accent)]">
            {title}
          </h3>
          {excerpt ? (
            <p className="is-body hidden is-line-clamp-2 text-sm sm:block">
              {excerpt}
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
