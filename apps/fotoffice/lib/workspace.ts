import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth, type AuthUser } from "./auth";
import { COURSES_SALES_MODULE_KEY, FOTOFFICE_WORKSPACE_COOKIE } from "./courses-sales/constants";
import { EVALUACIONES_MODULE_KEY } from "./evaluaciones/constants";
import { WEBSITE_MODULE_KEY } from "./website/constants";
import { SERVICE_LEADS_MODULE_KEY } from "./service-leads/constants";
import { isModuleEnabledForWorkspace } from "./modules/gating";
import { hasModuleLevel } from "./permissions/module-access";
import { SLUGS_DNX } from "./slug-dnx";

export type ActiveWorkspace = {
  id: string;
  name: string;
};

/**
 * DEUDA DOCUMENTADA — dos resolutores de workspace conviven a propósito, no por error:
 *
 * - `resolveActiveWorkspace` (acá abajo): **solo lectura**, nunca crea un workspace.
 *   Es la fuente correcta para `(shell)/*` (courses-sales, evaluaciones, admin),
 *   que asume que el usuario ya pasó por un punto de entrada que garantiza que
 *   el workspace existe. Respeta `FOTOFFICE_WORKSPACE_COOKIE`
 *   (`switchWorkspaceAction`), por eso es la que soporta cambiar de workspace
 *   activo cuando el usuario pertenece a más de uno.
 *
 * - `findFotofficeWorkspaceForUser` (`./ensure-workspace.ts`), que los puntos de
 *   entrada reales usan a través de `requireOwnWorkspace`
 *   (`./entrada/require-own-workspace.ts`): **tampoco crea**. Es la fuente para
 *   `resolveFotofficePostLoginDestination`, `/workspace/*` y `/onboarding`, donde
 *   todavía no hay garantía de que el usuario tenga workspace; cuando no lo tiene,
 *   se le pregunta en `/bienvenida` en vez de fabricárselo. No lee la cookie por sí
 *   misma: `requireOwnWorkspace` se la pasa como preferencia.
 *   Sin preferencia válida, prioriza el workspace donde el usuario es
 *   `WORKSPACE_OWNER` (o el más antiguo).
 *
 * Hasta el 2026-09-14 esa segunda función creaba el workspace si faltaba, y de ahí
 * salieron dos instituciones fantasma en producción. Crear quedó separado en
 * `createFotofficeWorkspaceForUser`, con un solo llamador autorizado.
 *
 * Desde la etapa 3 de Roles (2026-10-03) las dos respetan la cookie de institución
 * activa cuando la persona es miembro de esa institución, así `/workspace` y el
 * encabezado muestran la misma institución que eligió.
 */

export async function getMembershipWorkspaceIds(userId: number): Promise<string[]> {
  const unifiedRows = await prisma.workspaceMembership.findMany({
    where: { userId },
    select: { workspaceId: true },
  });
  if (unifiedRows.length > 0) {
    return unifiedRows.map((r) => r.workspaceId);
  }
  const fallbackRows = await prisma.membership.findMany({
    where: { userId },
    select: { workspaceId: true },
  });
  return fallbackRows.map((r) => r.workspaceId);
}

export async function resolveActiveWorkspace(userId: number): Promise<ActiveWorkspace | null> {
  const memberships = await prisma.workspaceMembership.findMany({
    where: { userId },
    select: { workspaceId: true, workspace: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const effectiveMemberships =
    memberships.length > 0
      ? memberships
      : await prisma.membership.findMany({
          where: { userId },
          select: { workspaceId: true, workspace: { select: { id: true, name: true } } },
          orderBy: { id: "asc" },
        });
  if (effectiveMemberships.length === 0) return null;

  // La institución que la persona eligió (selector de institución, botón "Administración")
  // manda, siempre que sea miembro de ella. Una cookie ajena no encuentra membresía y se ignora.
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(FOTOFFICE_WORKSPACE_COOKIE)?.value;
  if (fromCookie) {
    const hit = effectiveMemberships.find((m) => m.workspaceId === fromCookie);
    if (hit) return { id: hit.workspace.id, name: hit.workspace.name };
  }

  // Preferencia por DNX Estudio: su dirección real primero, la histórica después.
  let branding: { workspaceId: string } | null = null;
  for (const publicSlug of SLUGS_DNX) {
    branding = await prisma.fotofficeWorkspaceBranding.findUnique({
      where: { publicSlug },
      select: { workspaceId: true },
    });
    if (branding) break;
  }
  if (branding) {
    const match = effectiveMemberships.find(
      (m) => m.workspaceId === branding.workspaceId
    );
    if (match) {
      return { id: match.workspace.id, name: match.workspace.name };
    }
  }

  const first = effectiveMemberships[0];
  return first ? { id: first.workspace.id, name: first.workspace.name } : null;
}

export async function assertWorkspaceMember(userId: number, workspaceId: string): Promise<void> {
  const unified = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (unified) return;
  const fallback = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!fallback) throw new Error("Sin acceso a este workspace.");
}

/** @deprecated usar `isModuleEnabledForWorkspace(workspaceId, COURSES_SALES_MODULE_KEY)` de `./modules/gating`. Se mantiene por compatibilidad con los callers existentes. */
export async function isCoursesSalesEnabledForWorkspace(workspaceId: string): Promise<boolean> {
  return isModuleEnabledForWorkspace(workspaceId, COURSES_SALES_MODULE_KEY);
}

/** @deprecated usar `isModuleEnabledForWorkspace(workspaceId, EVALUACIONES_MODULE_KEY)` de `./modules/gating`. Se mantiene por compatibilidad con los callers existentes. */
export async function isEvaluacionesEnabledForWorkspace(workspaceId: string): Promise<boolean> {
  return isModuleEnabledForWorkspace(workspaceId, EVALUACIONES_MODULE_KEY);
}

/** Sesión + workspace activo si el usuario tiene membresías. */
export async function requireActiveWorkspace(): Promise<{
  user: AuthUser;
  workspace: ActiveWorkspace | null;
}> {
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  return { user, workspace };
}

/** Nivel mínimo que pide una puerta: las páginas ven (VIEW), las acciones gestionan (MANAGE). */
export type ModuleMinimum = "VIEW" | "MANAGE";

/**
 * Núcleo genérico: resuelve usuario + workspace activo (misma lógica de
 * siempre), exige que `moduleKey` esté habilitado —redirigiendo a `offRedirect`
 * si no lo está— y que la persona tenga al menos `minimum` en ese módulo; sin
 * ese nivel vuelve al tablero (diseño de roles, §9).
 *
 * El encendido se mira antes que el nivel a propósito: con el módulo apagado el
 * nivel es siempre NONE, y el aviso "módulo apagado" explica mejor qué pasa.
 */
async function requireModuleContext(
  moduleKey: string,
  offRedirect: string,
  minimum: ModuleMinimum = "VIEW",
): Promise<{ user: AuthUser; workspace: ActiveWorkspace }> {
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) redirect("/dashboard");
  const on = await isModuleEnabledForWorkspace(workspace.id, moduleKey);
  if (!on) redirect(offRedirect);
  if (!(await hasModuleLevel(user.id, workspace.id, moduleKey, minimum))) redirect("/dashboard");
  return { user, workspace };
}

/**
 * Exige módulo courses-sales activo y el nivel pedido. Las páginas usan VIEW (omisión);
 * toda acción que escribe pasa `"MANAGE"`.
 */
export async function requireCoursesSalesContext(minimum: ModuleMinimum = "VIEW"): Promise<{
  user: AuthUser;
  workspace: ActiveWorkspace;
}> {
  return requireModuleContext(COURSES_SALES_MODULE_KEY, "/dashboard?courses=off", minimum);
}

/** Exige módulo evaluaciones activo y el nivel pedido (páginas VIEW, acciones MANAGE). */
export async function requireEvaluacionesContext(minimum: ModuleMinimum = "VIEW"): Promise<{
  user: AuthUser;
  workspace: ActiveWorkspace;
}> {
  return requireModuleContext(EVALUACIONES_MODULE_KEY, "/dashboard?evaluaciones=off", minimum);
}

/**
 * Exige Captación (pedidos de servicio) activo y el nivel pedido: la bandeja y las pantallas
 * de formularios piden VIEW; crear o editar un formulario, MANAGE. Hasta la etapa 2b sólo
 * pedía sesión: cualquiera con membresía veía las consultas, con el módulo apagado o no.
 */
export async function requireServiceLeadsContext(minimum: ModuleMinimum = "VIEW"): Promise<{
  user: AuthUser;
  workspace: ActiveWorkspace;
}> {
  return requireModuleContext(SERVICE_LEADS_MODULE_KEY, "/dashboard?module=off", minimum);
}

/** Exige módulo website activo; ver las pantallas del CMS pide `website` VIEW. */
export async function requireWebsiteContext(): Promise<{
  user: AuthUser;
  workspace: ActiveWorkspace;
}> {
  return requireModuleContext(WEBSITE_MODULE_KEY, "/dashboard?website=off", "VIEW");
}
