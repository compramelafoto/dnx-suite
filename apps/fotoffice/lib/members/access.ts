import { redirect } from "next/navigation";
import { getAuthUser, requireAuth, type AuthUser } from "@/lib/auth";
import { resolveActiveWorkspace, type ActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { MEMBERS_MODULE_KEY } from "./constants";

export type MembersContext = {
  user: AuthUser;
  workspace: ActiveWorkspace;
  /** Nivel MANAGE en Socios: puede crear/editar socios, cambiar estado y administrar categorías. VIEW sólo consulta. */
  canManage: boolean;
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

  const level = await getModuleLevel(user.id, workspace.id, MEMBERS_MODULE_KEY);
  if (level === "NONE") redirect("/dashboard");
  return { user, workspace, canManage: level === "MANAGE" };
}

/** Para rutas de alta/edición/categorías: exige además rol OWNER/ADMIN. STAFF queda afuera aunque entre por URL directa. */
export async function requireMembersManageContext(): Promise<MembersContext> {
  const ctx = await requireMembersContext();
  if (!ctx.canManage) redirect("/members?forbidden=manage");
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

  // La exportación masiva se lleva datos personales de todo el padrón: sólo nivel MANAGE.
  const level = await getModuleLevel(user.id, workspace.id, MEMBERS_MODULE_KEY);
  if (level !== "MANAGE") return null;

  return { user, workspace, canManage: true };
}
