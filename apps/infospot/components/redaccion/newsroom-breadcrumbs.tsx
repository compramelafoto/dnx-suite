"use client";

import Link from "next/link";

export type NewsroomCrumb = {
  label: string;
  href?: string;
};

type Props = {
  items: NewsroomCrumb[];
};

/**
 * Migas de pan con lenguaje de sala de prensa (sin rutas técnicas).
 */
export function NewsroomBreadcrumbs({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Ubicación en el Centro Editorial" className="mb-6">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-[var(--is-muted)]">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
              {index > 0 ? (
                <span aria-hidden className="text-[var(--is-border-strong)]">
                  /
                </span>
              ) : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="font-medium text-[var(--is-text-secondary)] hover:text-[var(--is-accent)] hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={isLast ? "font-semibold text-[var(--is-text)]" : undefined}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
