import Link from "next/link";
import { cx } from "@/components/foundations/cx";
import { CategoryBadge } from "@/components/editorial/CategoryBadge";
import { ArticleMetadata } from "@/components/editorial/ArticleMetadata";
import type { ArticleCardProps } from "@/components/editorial/types";

/** Destacada: imagen protagonista + titular grande + CTA editorial. */
export function ArticleCardFeatured({
  title,
  excerpt,
  href,
  imageUrl,
  imageAlt = "",
  category,
  categorySlug,
  publishedAt,
  location,
  priority = true,
  className,
}: ArticleCardProps) {
  return (
    <article
      className={cx(
        "overflow-hidden rounded-[var(--is-radius-lg)] border border-[var(--is-border)] bg-[var(--is-surface)]",
        className,
      )}
    >
      <Link
        href={href}
        className="grid md:grid-cols-[1.35fr_1fr]"
      >
        <div className="relative min-h-[220px] overflow-hidden bg-[var(--is-surface-muted)] md:min-h-[360px]">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={imageAlt || title}
              className="absolute inset-0 h-full w-full object-cover"
              loading={priority ? "eager" : "lazy"}
              decoding={priority ? "sync" : "async"}
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 bg-[var(--is-surface-muted)]" aria-hidden />
          )}
        </div>
        <div className="flex flex-col justify-center gap-4 p-6 md:gap-5 md:p-10">
          <div className="flex flex-wrap items-center gap-3">
            {category ? (
              <CategoryBadge name={category} slug={categorySlug} asLink={false} />
            ) : null}
            <ArticleMetadata date={publishedAt} location={location} />
          </div>
          <h2 className="is-display-l text-wrap break-words">{title}</h2>
          {excerpt ? (
            <p className="is-lead is-line-clamp-4">{excerpt}</p>
          ) : null}
          <span className="is-btn is-btn-primary mt-2 w-fit">Leer nota</span>
        </div>
      </Link>
    </article>
  );
}
