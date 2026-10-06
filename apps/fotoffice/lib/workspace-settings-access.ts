/**
 * Política de permisos de "Configuración del Workspace" (branding, contacto, slug público).
 * OWNER/ADMIN → ven y editan. STAFF → solo lectura. `role` acepta tanto `WorkspaceRole` (nuevo,
 * `WorkspaceMembership`) como `MembershipRole` legacy (`ADMIN`/`MEMBER`).
 */
export function canManageWorkspaceSettings(role: string | null | undefined): boolean {
  return role === "WORKSPACE_OWNER" || role === "WORKSPACE_ADMIN" || role === "ADMIN";
}
