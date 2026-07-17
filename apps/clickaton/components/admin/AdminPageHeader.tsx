import type { ReactNode } from "react";
import { AdminBreadcrumbs, type AdminBreadcrumbItem } from "@/components/admin/AdminBreadcrumbs";
import { cn } from "@/lib/cn";

type Props = {
  title: string;
  description?: string;
  breadcrumbs?: readonly AdminBreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
};

export function AdminPageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: Props) {
  return (
    <header className={cn("space-y-3 border-b border-ck-border pb-6", className)}>
      {breadcrumbs ? <AdminBreadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="font-[family-name:var(--font-ck-display)] text-3xl tracking-wide text-ck-text sm:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-ck-text-secondary sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
