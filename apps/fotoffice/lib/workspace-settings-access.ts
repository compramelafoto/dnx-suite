import { puede } from "@/lib/access/policy";

/**
 * Política de permisos de "Configuración del Workspace" (branding, contacto, slug público).
 * OWNER/ADMIN → ven y editan. STAFF (Equipo) → solo lectura. Delega en `lib/access/policy`
 * (capacidad `configurar`). `role` acepta tanto `WorkspaceRole` (nuevo,
 * `WorkspaceMembership`) como `MembershipRole` legacy (`ADMIN`/`MEMBER`).
 */
export function canManageWorkspaceSettings(role: string | null | undefined): boolean {
  return puede(role, "configurar");
}
