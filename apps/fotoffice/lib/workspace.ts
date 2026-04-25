import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth, type AuthUser } from "./auth";
import { COURSES_SALES_MODULE_KEY, FOTOFFICE_WORKSPACE_COOKIE } from "./courses-sales/constants";
import { isMissingCoursesSalesSchemaError } from "./courses-sales/prisma-errors";

export type ActiveWorkspace = {
  id: string;
  name: string;
};

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

export async function isCoursesSalesEnabledForWorkspace(workspaceId: string): Promise<boolean> {
  try {
    const row = await prisma.workspaceFeatureModule.findUnique({
      where: {
        workspaceId_moduleKey: { workspaceId, moduleKey: COURSES_SALES_MODULE_KEY },
      },
    });
    return row?.enabled === true;
  } catch (e) {
    if (isMissingCoursesSalesSchemaError(e)) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[fotoffice] Tablas del módulo courses-sales ausentes. Ejecutá la migración SQL (p. ej. `packages/db/prisma/migrations/20260331230000_fotoffice_courses_sales/migration.sql`) o `prisma migrate deploy` en una BD alineada con el historial de migraciones.",
        );
      }
      return false;
    }
    throw e;
  }
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

/** Exige módulo courses-sales activo en el workspace actual. */
export async function requireCoursesSalesContext(): Promise<{
  user: AuthUser;
  workspace: ActiveWorkspace;
}> {
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) redirect("/dashboard");
  const on = await isCoursesSalesEnabledForWorkspace(workspace.id);
  if (!on) redirect("/dashboard?courses=off");
  return { user, workspace };
}
