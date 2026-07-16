"use client";

import { brandManualSections } from "@/config/brand-manual";
import { cn } from "@/lib/cn";

export function BrandManualToc({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Secciones del manual"
      className={cn(
        "flex flex-wrap gap-2 border-b border-ck-border pb-6",
        className,
      )}
    >
      {brandManualSections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="ck-label rounded-full border border-ck-border bg-ck-surface px-4 py-2 text-ck-text-secondary transition-colors hover:border-ck-yellow hover:text-ck-yellow"
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}
