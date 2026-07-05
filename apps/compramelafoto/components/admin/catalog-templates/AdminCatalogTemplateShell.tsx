"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Breadcrumb = {
  label: string;
  href?: string;
};

type AdminCatalogTemplateShellProps = {
  children: ReactNode;
  title: string;
  subtitle?: ReactNode;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
  className?: string;
};

export default function AdminCatalogTemplateShell({
  children,
  title,
  subtitle,
  breadcrumbs,
  actions,
  className,
}: AdminCatalogTemplateShellProps) {
  return (
    <div className={cn("ds-admin-cms ds-admin-cms-stack", className)}>
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1 min-w-0">
              {i > 0 ? <span className="ds-admin-cms-breadcrumb__sep">/</span> : null}
              {crumb.href ? (
                <Link href={crumb.href} className="ds-admin-cms-breadcrumb truncate">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[#374151] text-sm truncate">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}

      <header className="ds-catalog-header">
        <div className="ds-catalog-header__text min-w-0">
          <h1 className="ds-catalog-title">{title}</h1>
          {subtitle ? (
            typeof subtitle === "string" ? (
              <p className="ds-catalog-subtitle">{subtitle}</p>
            ) : (
              <div className="ds-catalog-subtitle">{subtitle}</div>
            )
          ) : null}
        </div>
        {actions ? <div className="ds-catalog-header__actions">{actions}</div> : null}
      </header>

      {children}
    </div>
  );
}
