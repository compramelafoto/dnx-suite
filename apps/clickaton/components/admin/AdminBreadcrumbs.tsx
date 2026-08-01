import Link from "next/link";
import { adminRoutes } from "@/config/admin/navigation";
import { cn } from "@/lib/cn";

export type AdminBreadcrumbItem = {
  label: string;
  href?: string;
};

type Props = {
  items: readonly AdminBreadcrumbItem[];
  className?: string;
};

export function AdminBreadcrumbs({ items, className }: Props) {
  const crumbs: AdminBreadcrumbItem[] = [
    { label: "Inicio", href: adminRoutes.dashboard },
    ...items,
  ];

  return (
    <nav aria-label="Migas de pan" className={cn("text-sm text-ck-text-muted", className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {crumbs.map((item, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden className="text-ck-border-strong">/</span> : null}
              {isLast || !item.href ? (
                <span className={cn(isLast && "font-medium text-ck-text")}>{item.label}</span>
              ) : (
                <Link
                  href={item.href}
                  className="transition-colors hover:text-ck-yellow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ck-yellow"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
