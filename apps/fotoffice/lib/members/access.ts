import { redirect } from "next/navigation";
import { getAuthUser, requireAuth, type AuthUser } from "@/lib/auth";
import { resolveActiveWorkspace, type ActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { MEMBERS_MODULE_KEY } from "./constants";
import { puede } from "@/lib/access/policy";
import { canConfigureMembers, canManageMembers } from "./role-policy";

export type MembersContext = {
  user: AuthUser;
  workspace: ActiveWorkspace;
  /** Puede operar socios (Dueño, Admin y Equipo): crear/editar, cambiar estado, cuotas, carnets. */
  canManage: boolean;
  /** Dueño/Admin: además puede configurar (categorías, valores, diseñador, permisos de carnets). */
  canConfigure: boolean;
};

/**
 * Gating de 2 niveles, igual que courses-sales/evaluaciones: (1) resuelve
 * auth + workspace activo, (2) exige que el módulo `members` esté habilitado
 * para ESE workspace — no alcanza con ocultar el link en el sidebar, esto
 * corre en cada request, incluida la entrada directa por URL.
 */
export async function requireMembersContext(): Promise<MembersContext> {
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) redirect("/dashboard");

  const enabled = await isModuleEnabledForWorkspace(workspace.id, MEMBERS_MODULE_KEY);
  if (!enabled) redirect("/dashboard?module=off");

  const role = await resolveWorkspaceRole(user.id, workspace.id);
  // Colaborador (y quien no tenga rol) no recibe nada de los módulos existentes.
  if (!puede(role, "operar")) redirect("/dashboard");
  return { user, workspace, canManage: canManageMembers(role), canConfigure: canConfigureMembers(role) };
}

/** Para rutas de alta/edición de socios: exige operar (Dueño, Admin o Equipo). Colaborador queda afuera aunque entre por URL directa. */
export async function requireMembersManageContext(): Promise<MembersContext> {
  const ctx = await requireMembersContext();
  if (!ctx.canManage) redirect("/members?forbidden=manage");
  return ctx;
}

/** Para categorías y demás configuración de socios: sólo Dueño/Admin. Equipo queda afuera aunque entre por URL directa. */
export async function requireMembersConfigureContext(): Promise<MembersContext> {
  const ctx = await requireMembersContext();
  if (!ctx.canConfigure) redirect("/members?forbidden=configurar");
  return ctx;
}

/**
 * Variante para route handlers (descargas). Devuelve `null` en vez de redirigir: un `redirect`
 * en una descarga produciría un archivo con el HTML de otra página en vez de un error.
 *
 * Toda denegación es indistinguible —sin sesión, sin workspace, módulo apagado o rol STAFF
 * responden lo mismo— para no filtrar por diferencia de respuestas qué workspaces existen ni
 * qué módulos tienen habilitados.
 */
export async function resolveMembersExportContext(): Promise<MembersContext | null> {
  const user = await getAuthUser();
  if (!user) return null;

  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;

  const enabled = await isModuleEnabledForWorkspace(workspace.id, MEMBERS_MODULE_KEY);
  if (!enabled) return null;

  const role = await resolveWorkspaceRole(user.id, workspace.id);
  // Desde 0.1 exportar es operar: Equipo incluido (Colaborador y sin rol siguen afuera).
  if (!canManageMembers(role)) return null;

  return { user, workspace, canManage: true, canConfigure: canConfigureMembers(role) };
}
