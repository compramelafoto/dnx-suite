"use client";

import { useRouter } from "next/navigation";
import { QuickSearch, type QuickSearchEntry } from "@repo/quick-search";
import { AdminNavIcon } from "@/components/admin/AdminNavIcon";
import type { AdminNavItem } from "@/config/admin/navigation";
import { ADMIN_NAV_KEYWORDS } from "@/config/admin/navigation-keywords";

/**
 * La lupa de arriba del menú del panel (también abre con ⌘K / Ctrl+K). Recibe exactamente lo
 * que el menú dibuja, agrupado igual, y le suma los sinónimos de `navigation-keywords.ts`.
 */
export function AdminMenuSearch({
  groups,
  onNavigate,
}: {
  groups: { title: string; items: readonly AdminNavItem[] }[];
  /** En el teléfono el menú tapa el contenido: ir a una opción tiene que cerrarlo. */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const entries: QuickSearchEntry[] = groups.flatMap((group) =>
    group.items.map((item) => ({
      id: item.href,
      label: item.label,
      href: item.href,
      group: group.title,
      description: item.description,
      keywords: ADMIN_NAV_KEYWORDS[item.href],
      icon: <AdminNavIcon name={item.icon} />,
    })),
  );

  return (
    <QuickSearch
      entries={entries}
      onNavigate={(href) => {
        onNavigate?.();
        router.push(href);
      }}
      className="hover:text-ck-text"
      theme={{
        bg: "var(--ck-surface-elevated)",
        fg: "var(--ck-text-primary)",
        muted: "var(--ck-text-muted)",
        border: "var(--ck-border-strong)",
        hover: "var(--ck-surface-strong)",
        active: "var(--ck-brand-primary-soft)",
        accent: "var(--ck-brand-primary)",
        triggerBg: "var(--ck-surface)",
        overlay: "rgb(0 0 0 / 0.6)",
      }}
    />
  );
}
