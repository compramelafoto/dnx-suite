import Link from "next/link";
import { Cluster } from "@/components/foundations";
import { cx } from "@/components/foundations/cx";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type Props = {
  items: BreadcrumbItem[];
  className?: string;
};

export function Breadcrumbs({ items, className }: Props) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Migas de pan" className={cx("is-metadata", className)}>
      <Cluster gap={2} as="ol" className="list-none">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
              {index > 0 ? <span aria-hidden>/</span> : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-[var(--is-accent)]"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={isLast ? "text-[var(--is-text-secondary)]" : undefined}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </Cluster>
    </nav>
  );
}
