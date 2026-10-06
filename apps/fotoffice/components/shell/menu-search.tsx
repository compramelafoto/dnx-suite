"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { QuickSearch, type QuickSearchEntry } from "@repo/quick-search";
import { NAV_KEYWORDS } from "@/lib/shell/nav-keywords";

export type MenuSearchSection = {
  title: string;
  items: { href: string; label: string; description?: string; icon?: ReactNode }[];
};

/**
 * La lupa de arriba del menú. Recibe exactamente lo que el menú dibuja —ya filtrado por
 * módulos y permisos— y le suma los sinónimos de `nav-keywords.ts`.
 */
export function MenuSearch({
  sections,
  onNavigate,
}: {
  sections: MenuSearchSection[];
  /** En el teléfono el menú tapa el contenido: ir a una opción tiene que cerrarlo. */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const entries: QuickSearchEntry[] = sections.flatMap((sec) =>
    sec.items.map((item) => ({
      id: item.href,
      label: item.label,
      href: item.href,
      group: sec.title,
      description: item.description,
      keywords: NAV_KEYWORDS[item.href],
      icon: item.icon,
    })),
  );

  return (
    <div className="mb-3">
      <QuickSearch
        entries={entries}
        onNavigate={(href) => {
          onNavigate?.();
          router.push(href);
        }}
        className="hover:text-[var(--fo-text)]"
        theme={{
          bg: "var(--fo-bg-elevated)",
          fg: "var(--fo-text)",
          muted: "var(--fo-muted)",
          border: "var(--fo-border)",
          active: "var(--fo-accent-muted)",
          accent: "var(--fo-accent)",
          triggerBg: "var(--fo-surface-hover)",
        }}
      />
    </div>
  );
}
