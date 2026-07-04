import { prisma } from "@/lib/prisma";

export type WorkspaceOption = { id: string; name: string };

/**
 * Workspaces donde el usuario tiene membresía (unificado primero, legacy `Membership` si no hay filas nuevas).
 */
export async function getWorkspaceOptionsForUser(userId: number): Promise<WorkspaceOption[]> {
  const unified = await prisma.workspaceMembership.findMany({
    where: { userId },
    include: { workspace: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (unified.length > 0) {
    return unified.map((m) => ({ id: m.workspace.id, name: m.workspace.name }));
  }
  const fallback = await prisma.membership.findMany({
    where: { userId },
    include: { workspace: { select: { id: true, name: true } } },
    orderBy: { id: "asc" },
  });
  return fallback.map((m) => ({ id: m.workspace.id, name: m.workspace.name }));
}
