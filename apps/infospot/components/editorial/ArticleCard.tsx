import Link from "next/link";
import { CategoryBadge } from "@/components/editorial/CategoryBadge";
import { ArticleMetadata } from "@/components/editorial/ArticleMetadata";
import type { ArticleCardProps } from "@/components/editorial/types";
import { cx } from "@/components/foundations/cx";

/** Pieza editorial — foto grande, sin caja CMS. */
export function ArticleCard({
  title,
  excerpt,
  href,
  imageUrl,
  imageAlt = "",
  category,
  categorySlug,
  publishedAt,
  authorName,
  location,
  priority = false,
  className,
}: ArticleCardProps) {
  return (
    <article className={cx("group flex h-full flex-col", className)}>
      <Link href={href} className="flex h-full flex-col">
        <div className="overflow-hidden bg-[var(--is-graphite-100)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl || "/editorial-stock/concert.jpg"}
            alt={imageAlt || title}
            className="aspect-[16/11] w-full object-cover transition-[transform] duration-[var(--is-duration-300)] ease-[var(--is-ease-out)] group-hover:scale-[1.02] md:aspect-[16/10]"
            loading={priority ? "eager" : "lazy"}
            decoding={priority ? "sync" : "async"}
            draggable={false}
          />
        </div>
        <div className="flex flex-1 flex-col gap-3 pt-5 md:gap-4 md:pt-7">
          <div className="flex flex-wrap items-center gap-3">
            {category ? (
              <CategoryBadge name={category} slug={categorySlug} asLink={false} />
            ) : null}
            <ArticleMetadata date={publishedAt} location={location} />
          </div>
          <h3 className="is-h3 text-wrap break-words group-hover:text-[var(--is-accent)] md:text-2xl">
            {title}
          </h3>
          {excerpt ? (
            <p className="is-body is-line-clamp-3 text-[0.95rem] md:text-base">
              {excerpt}
            </p>
          ) : null}
          {authorName ? (
            <p className="is-metadata mt-auto pt-2">{authorName}</p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
