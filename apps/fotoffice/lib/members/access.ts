import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth, type AuthUser } from "@/lib/auth";
import { resolveActiveWorkspace, type ActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { MEMBERS_MODULE_KEY } from "./constants";
import { canManageMembers } from "./role-policy";

export type MembersContext = {
  user: AuthUser;
  workspace: ActiveWorkspace;
  /** OWNER/ADMIN del workspace: puede crear/editar socios, cambiar estado y administrar categorías. STAFF solo consulta. */
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

  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    select: { role: true },
  });
  return { user, workspace, canManage: canManageMembers(membership?.role) };
}

/** Para rutas de alta/edición/categorías: exige además rol OWNER/ADMIN. STAFF queda afuera aunque entre por URL directa. */
export async function requireMembersManageContext(): Promise<MembersContext> {
  const ctx = await requireMembersContext();
  if (!ctx.canManage) redirect("/members?forbidden=manage");
  return ctx;
}
