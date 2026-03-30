import Link from "next/link";

export type BreadcrumbItem = { label: string; href?: string };

export function DashboardBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fr-muted">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="inline-flex items-center gap-2">
          {i > 0 ? <span className="text-fr-border" aria-hidden>/</span> : null}
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-gold">
              {item.label}
            </Link>
          ) : (
            <span className="text-fr-muted-soft">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
