"use client";

/**
 * Renderiza secciones e ítems desde configuración (`SidebarSectionConfig[]`).
 * Filtrá antes con `filterSidebarByRoles` si usás roles.
 */

import type { SidebarSectionConfig } from "../../sidebar/sidebarConfig.types";
import { isSidebarPathActive } from "../../sidebar/pathUtils";
import type { SidebarLinkComponent } from "./SidebarItem";
import { SidebarItem } from "./SidebarItem";
import { SidebarSection } from "./SidebarSection";

export interface SidebarNavFromConfigProps {
  sections: readonly SidebarSectionConfig[];
  /** Ruta actual (ej. `usePathname()` en Next.js). */
  activePath: string;
  LinkComponent?: SidebarLinkComponent;
  onNavigate?: () => void;
  /** Igualdad estricta con `href` en lugar de prefijo. */
  exactMatch?: boolean;
}

export function SidebarNavFromConfig({
  sections,
  activePath,
  LinkComponent,
  onNavigate,
  exactMatch = false,
}: SidebarNavFromConfigProps) {
  return (
    <nav aria-label="Principal">
      {sections.map((section, sectionIndex) => (
        <SidebarSection key={`${section.title ?? "section"}-${sectionIndex}`} title={section.title}>
          {section.items.map((item) => {
            const active = isSidebarPathActive(activePath, item.href, { exact: exactMatch });
            return (
              <SidebarItem
                key={item.href + item.label}
                href={item.href}
                label={item.label}
                icon={item.icon}
                badge={item.badge}
                active={active}
                LinkComponent={LinkComponent}
                onNavigate={onNavigate}
              />
            );
          })}
        </SidebarSection>
      ))}
    </nav>
  );
}
