"use client";

import type { ReactNode } from "react";

type Section = {
  id: string;
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

type Props = {
  sections: Section[];
};

/**
 * Paneles administrativos colapsables (SEO, publicación, CLF…).
 * Fuera de la columna de escritura.
 */
export function EditorConfigAccordion({ sections }: Props) {
  return (
    <div className="space-y-3" role="region" aria-label="Configuración editorial">
      {sections.map((section) => (
        <details
          key={section.id}
          className="group rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-white open:shadow-sm"
          open={section.defaultOpen}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
            <span>
              {section.title}
              {section.hint ? (
                <span className="mt-0.5 block text-xs font-normal text-[var(--is-muted)]">
                  {section.hint}
                </span>
              ) : null}
            </span>
            <span
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--is-border)] text-xs text-[var(--is-muted)] transition group-open:rotate-180"
              aria-hidden
            >
              ▾
            </span>
          </summary>
          <div className="space-y-4 border-t border-[var(--is-border)] px-4 py-4">
            {section.children}
          </div>
        </details>
      ))}
    </div>
  );
}
