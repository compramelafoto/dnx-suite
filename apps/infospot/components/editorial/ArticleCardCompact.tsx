import Link from "next/link";
import { cx } from "@/components/foundations/cx";
import { CategoryBadge } from "@/components/editorial/CategoryBadge";
import { ArticleMetadata } from "@/components/editorial/ArticleMetadata";
import type { ArticleCardProps } from "@/components/editorial/types";

/** Compacta con thumb fotográfico (nunca vacío gris). */
export function ArticleCardCompact({
  title,
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
  const src = imageUrl || "/editorial-stock/people.jpg";

  return (
    <article
      className={cx(
        "border-b border-[var(--is-border)] py-4 last:border-b-0",
        className,
      )}
    >
      <Link
        href={href}
        className="group grid grid-cols-[4.5rem_1fr] gap-3 sm:grid-cols-[5.5rem_1fr] sm:gap-4"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={imageAlt || title}
          className="aspect-square w-full rounded-[var(--is-radius-sm)] object-cover"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
        />
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {category ? (
              <CategoryBadge name={category} slug={categorySlug} asLink={false} />
            ) : null}
            <ArticleMetadata date={publishedAt} location={location} />
          </div>
          <h3 className="is-h3 text-base leading-snug text-wrap break-words group-hover:text-[var(--is-accent)] md:text-lg">
            {title}
          </h3>
        </div>
      </Link>
    </article>
  );
}
