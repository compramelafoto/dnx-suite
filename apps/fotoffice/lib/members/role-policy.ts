/**
 * Política de permisos del módulo Socios, en esta etapa:
 * OWNER/ADMIN → crear, editar, cambiar estado, administrar categorías.
 * STAFF → solo consultar padrón y ficha.
 * No hay roles granulares (SECRETARIO/TESORERO/PRESIDENTE) todavía — eso
 * viene después. `role` acepta tanto el enum nuevo (`WorkspaceRole`) como
 * el legacy (`MembershipRole`, fallback cuando no hay `WorkspaceMembership`).
 */
export function canManageMembers(role: string | null | undefined): boolean {
  return role === "WORKSPACE_OWNER" || role === "WORKSPACE_ADMIN" || role === "ADMIN";
}
