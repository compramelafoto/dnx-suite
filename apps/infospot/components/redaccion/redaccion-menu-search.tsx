"use client";

import { useRouter } from "next/navigation";
import { QuickSearch, type QuickSearchEntry } from "@repo/quick-search";
import { REDACCION_NAV_KEYWORDS } from "@/lib/redaccion-nav-keywords";

export type RedaccionMenuSearchGroup = {
  title: string;
  items: readonly { href: string; label: string; hint?: string }[];
};

/**
 * La lupa de arriba del menú de la redacción (también abre con ⌘K / Ctrl+K). Recibe
 * exactamente lo que el menú dibuja —ya filtrado por permisos— y le suma los sinónimos de
 * `redaccion-nav-keywords.ts`. La pista (`hint`) de cada opción se usa como descripción.
 */
export function RedaccionMenuSearch({
  groups,
  compact = false,
  onNavigate,
}: {
  groups: RedaccionMenuSearchGroup[];
  compact?: boolean;
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
      description: item.hint,
      keywords: REDACCION_NAV_KEYWORDS[item.href],
    })),
  );

  return (
    <QuickSearch
      entries={entries}
      compact={compact}
      onNavigate={(href) => {
        onNavigate?.();
        router.push(href);
      }}
      className="hover:text-[var(--is-accent)]"
      theme={{
        bg: "var(--is-surface)",
        fg: "var(--is-text)",
        muted: "var(--is-muted)",
        border: "var(--is-border)",
        hover: "var(--is-bg-secondary)",
        active: "var(--is-orange-50)",
        accent: "var(--is-accent)",
        triggerBg: "var(--is-bg-secondary)",
      }}
    />
  );
}
