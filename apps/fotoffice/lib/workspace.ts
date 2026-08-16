import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth, type AuthUser } from "./auth";
import { COURSES_SALES_MODULE_KEY, FOTOFFICE_WORKSPACE_COOKIE } from "./courses-sales/constants";
import { EVALUACIONES_MODULE_KEY } from "./evaluaciones/constants";
import { isModuleEnabledForWorkspace } from "./modules/gating";

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
 * - `ensureFotofficeWorkspaceForUser` (`./ensure-workspace.ts`): **crea si hace
 *   falta** (bootstrap idempotente). Es la fuente correcta para los puntos de
 *   entrada reales — `resolveFotofficePostLoginDestination`, `/workspace/*`,
 *   `/onboarding` — donde todavía no hay garantía de que el usuario tenga
 *   workspace. NO lee `FOTOFFICE_WORKSPACE_COOKIE`: siempre prioriza el
 *   workspace donde el usuario es `WORKSPACE_OWNER` (o el más antiguo).
 *
 * Pendiente real (no resuelto en esta etapa, requiere tocar la firma de
 * `ensureFotofficeWorkspaceForUser` y evaluar impacto en sus 3 callers):
 * si un usuario cambia de workspace activo desde `(shell)` vía el switcher
 * del header y después navega a `/workspace`, va a ver el workspace por
 * defecto (OWNER-first), no el que acaba de elegir — porque `ensure*` no
 * consulta la cookie. No importa hoy (nadie tiene más de un workspace en la
 * práctica), pero va a importar el día que una institución tenga varios
 * administradores con acceso a varios workspaces.
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

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: "dnx-estudio" },
    select: { workspaceId: true },
  });
  if (branding) {
    const match = effectiveMemberships.find(
      (m) => m.workspaceId === branding.workspaceId
    );
    if (match) {
      return { id: match.workspace.id, name: match.workspace.name };
    }
  }

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(FOTOFFICE_WORKSPACE_COOKIE)?.value;
  if (fromCookie) {
    const hit = effectiveMemberships.find((m) => m.workspaceId === fromCookie);
    if (hit) return { id: hit.workspace.id, name: hit.workspace.name };
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

/**
 * Núcleo genérico: resuelve usuario + workspace activo (misma lógica de
 * siempre) y exige que `moduleKey` esté habilitado, redirigiendo a
 * `offRedirect` si no lo está. Los módulos futuros deberían llamar esto
 * directo en vez de agregar una función `requireXContext` nueva, salvo que
 * necesiten lógica adicional real (no solo un redirect distinto).
 */
async function requireModuleContext(
  moduleKey: string,
  offRedirect: string,
): Promise<{ user: AuthUser; workspace: ActiveWorkspace }> {
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) redirect("/dashboard");
  const on = await isModuleEnabledForWorkspace(workspace.id, moduleKey);
  if (!on) redirect(offRedirect);
  return { user, workspace };
}

/** Exige módulo courses-sales activo en el workspace actual. */
export async function requireCoursesSalesContext(): Promise<{
  user: AuthUser;
  workspace: ActiveWorkspace;
}> {
  return requireModuleContext(COURSES_SALES_MODULE_KEY, "/dashboard?courses=off");
}

/** Exige módulo evaluaciones activo en el workspace actual. */
export async function requireEvaluacionesContext(): Promise<{
  user: AuthUser;
  workspace: ActiveWorkspace;
}> {
  return requireModuleContext(EVALUACIONES_MODULE_KEY, "/dashboard?evaluaciones=off");
}
