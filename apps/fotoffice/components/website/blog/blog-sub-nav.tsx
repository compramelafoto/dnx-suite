"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BLOG_ADMIN_SECTIONS, blogAdminSectionFor } from "@/lib/blog/admin-nav";

/** Pestañas del blog, con el mismo dibujo que las del sitio web (`WebsiteSubNav`). */
export function BlogSubNav() {
  const activa = blogAdminSectionFor(usePathname() ?? "");

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 border-b border-[var(--fo-border)]">
      <Link
        href="/website"
        className="flex items-center gap-1 py-2.5 text-sm font-medium text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
      >
        <ChevronLeft className="h-4 w-4" /> Sitio web
      </Link>
      <nav className="flex gap-1 overflow-x-auto" aria-label="Secciones del blog">
        {BLOG_ADMIN_SECTIONS.map((s) => {
          const active = s.key === activa;
          return (
            <Link
              key={s.key}
              href={s.href}
              aria-current={active ? "page" : undefined}
              className={[
                "px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                active
                  ? "border-[var(--fo-accent)] text-[var(--fo-text)]"
                  : "border-transparent text-[var(--fo-muted)] hover:text-[var(--fo-text)]",
              ].join(" ")}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
