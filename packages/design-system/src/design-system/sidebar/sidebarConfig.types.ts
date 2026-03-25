/**
 * Configuración dinámica del menú lateral (no hardcodeada en componentes).
 * Cada app construye arrays de secciones e ítems y filtra por rol con `filterSidebarByRoles`.
 */

import type { IconName } from "../icons";

/**
 * Un enlace del sidebar.
 * - `icon`: nombre del catálogo del design system (`IconName`).
 * - `roles`: si se omite o está vacío, el ítem se muestra a cualquier usuario autenticado.
 *   Si tiene valores, el usuario debe tener al menos uno de esos roles.
 */
export type SidebarItemConfig = {
  label: string;
  href: string;
  icon: IconName;
  roles?: string[];
  badge?: number;
};

/**
 * Grupo de ítems (ej. "Gestión", "Finanzas").
 */
export type SidebarSectionConfig = {
  title?: string;
  items: SidebarItemConfig[];
};

/** Alias legibles para configs (evita colisión con el componente `SidebarItem`). */
export type SidebarMenuItem = SidebarItemConfig;
export type SidebarMenuSection = SidebarSectionConfig;
