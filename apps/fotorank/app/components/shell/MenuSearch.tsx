"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { QuickSearch, type QuickSearchEntry } from "@repo/quick-search";
import { Icon, type IconName } from "@repo/design-system";
import { MENU_KEYWORDS } from "./menu-keywords";
import type { ShellSection } from "./shell-nav";

/** Las secciones de un rol, con el nombre del rol para rotular los grupos. */
export type MenuSearchGrupo = {
  /** "Jurado". Sin rol (super admin, o una sola opción) va vacío. */
  rol?: string;
  sections: ShellSection[];
};

/**
 * La lupa de arriba de la barra lateral (y el atajo ⌘K).
 *
 * El menú muestra sólo lo del rol activo, pero el buscador busca en **todos** los roles de
 * la persona: quien está calificando como jurado y quiere ver sus participaciones no tiene
 * que acordarse de cambiar de rol primero. Recibe las secciones ya filtradas por permisos;
 * acá sólo se les suman los sinónimos de `menu-keywords.ts`.
 */
export function MenuSearch({
  grupos,
  onNavigate,
}: {
  grupos: MenuSearchGrupo[];
  /** En el teléfono la barra tapa el contenido: ir a una opción tiene que cerrarla. */
  onNavigate?: () => void;
}) {
  const router = useRouter();

  const entries = useMemo<QuickSearchEntry[]>(() => {
    // Con varios roles, el grupo dice de cuál es: "Jurado · Jurado" no aporta, así que si
    // la sección se llama igual que el rol queda sólo el rol.
    const varios = grupos.filter((g) => g.rol).length > 1;
    const vistos = new Set<string>();
    const lista: QuickSearchEntry[] = [];
    for (const grupo of grupos) {
      for (const sec of grupo.sections) {
        const titulo =
          varios && grupo.rol && grupo.rol !== sec.title ? `${grupo.rol} · ${sec.title}` : sec.title;
        for (const item of sec.items) {
          // Una misma pantalla puede figurar en dos roles: aparece una sola vez.
          if (vistos.has(item.href)) continue;
          vistos.add(item.href);
          lista.push({
            id: item.href,
            label: item.label,
            href: item.href,
            group: titulo,
            description: item.description,
            keywords: MENU_KEYWORDS[item.href],
            icon: <Icon name={item.icon as IconName} size="sm" />,
          });
        }
      }
    }
    return lista;
  }, [grupos]);

  return (
    <div className="border-b border-fr-border px-4 py-3">
      <QuickSearch
        entries={entries}
        onNavigate={(href) => {
          onNavigate?.();
          router.push(href);
        }}
        placeholder="¿A dónde querés ir? Concursos, jurados, diplomas…"
        theme={{
          bg: "var(--color-fr-bg-elevated)",
          fg: "var(--color-fr-primary)",
          muted: "var(--color-fr-muted-soft)",
          border: "var(--color-fr-border)",
          hover: "var(--color-fr-card)",
          active: "rgba(212, 175, 55, 0.14)",
          accent: "var(--color-gold)",
          triggerBg: "var(--color-fr-bg)",
          overlay: "rgba(0, 0, 0, 0.72)",
        }}
      />
    </div>
  );
}
