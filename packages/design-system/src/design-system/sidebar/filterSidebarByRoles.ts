import type { SidebarSectionConfig } from "./sidebarConfig.types";

/**
 * Devuelve una copia de las secciones filtrando ítems según `userRoles`.
 * - Ítem sin `roles` o con array vacío → visible para todos.
 * - Ítem con `roles` → visible si el usuario tiene al menos un rol en común.
 * Las secciones que quedan sin ítems se eliminan.
 */
export function filterSidebarByRoles(
  sections: readonly SidebarSectionConfig[],
  userRoles: readonly string[],
): SidebarSectionConfig[] {
  const roleSet = new Set(userRoles);

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const required = item.roles;
        if (required == null || required.length === 0) return true;
        return required.some((r) => roleSet.has(r));
      }),
    }))
    .filter((s) => s.items.length > 0);
}
