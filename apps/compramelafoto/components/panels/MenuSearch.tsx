"use client";

import type { CSSProperties, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { QuickSearch, type QuickSearchEntry, type QuickSearchTheme } from "@repo/quick-search";
import { descriptionFor, keywordsFor } from "@/config/menu-keywords";

export type MenuSearchSection = {
  title: string;
  items: { href: string; label: string; icon?: ReactNode }[];
};

/** La ventana siempre es clara: se lee mejor y combina con el naranja de la marca. */
const THEME: QuickSearchTheme = {
  bg: "#ffffff",
  fg: "#111827",
  muted: "#6b7280",
  border: "rgba(17, 24, 39, 0.12)",
  hover: "rgba(194, 123, 61, 0.06)",
  active: "rgba(194, 123, 61, 0.12)",
  accent: "#c27b3d",
  triggerBg: "#f9fafb",
};

/**
 * En el admin el menú es azul oscuro: el botón se pinta para ese fondo pisando las variables
 * solo en el botón. La ventana se dibuja aparte y sigue usando el tema claro.
 */
const ADMIN_TRIGGER_STYLE = {
  "--qs-muted": "rgba(255, 255, 255, 0.75)",
  "--qs-border": "rgba(255, 255, 255, 0.15)",
  "--qs-trigger-bg": "rgba(255, 255, 255, 0.08)",
} as CSSProperties;

/**
 * La lupa de arriba del menú. Recibe exactamente lo que el menú dibuja —ya armado según el
 * panel y el rol— y le suma los sinónimos de `config/menu-keywords.ts`. Si dos opciones llevan
 * al mismo lugar, queda la primera.
 */
export default function MenuSearch({
  sections,
  variant = "panel",
  onNavigate,
  className,
}: {
  sections: MenuSearchSection[];
  /** "admin" adapta el botón al menú oscuro del panel de administración. */
  variant?: "panel" | "admin";
  /** En el teléfono el menú tapa el contenido: ir a una opción puede tener que cerrarlo. */
  onNavigate?: () => void;
  className?: string;
}) {
  const router = useRouter();

  const vistos = new Set<string>();
  const entries: QuickSearchEntry[] = [];
  for (const sec of sections) {
    for (const item of sec.items) {
      if (!item.href || item.href === "#" || vistos.has(item.href)) continue;
      vistos.add(item.href);
      entries.push({
        id: item.href,
        label: item.label,
        href: item.href,
        group: sec.title,
        description: descriptionFor(item.href),
        keywords: keywordsFor(item.href),
        icon: item.icon,
      });
    }
  }

  if (entries.length === 0) return null;

  return (
    <div className={className}>
      <QuickSearch
        entries={entries}
        onNavigate={(href) => {
          onNavigate?.();
          router.push(href);
        }}
        theme={THEME}
        style={variant === "admin" ? ADMIN_TRIGGER_STYLE : undefined}
      />
    </div>
  );
}
