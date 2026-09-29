import { puede } from "@/lib/access/policy";

/**
 * Operar socios: alta, edición, importación, invitaciones, cuotas, carnets, solicitudes,
 * exportar. Desde 0.1 incluye a Equipo. Delega en `lib/access/policy` (capacidad `operar`).
 * `role` acepta el enum nuevo (`WorkspaceRole`) y el legacy (`MembershipRole`).
 */
export function canManageMembers(role: string | null | undefined): boolean {
  return puede(role, "operar");
}

/** Configurar socios: categorías, valores de cuota, calendario, diseñador y permisos de carnets. Sólo Dueño/Admin. */
export function canConfigureMembers(role: string | null | undefined): boolean {
  return puede(role, "configurar");
}
