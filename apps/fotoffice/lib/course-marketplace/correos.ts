import "server-only";
import { prisma } from "@repo/db";

/** Correos de los dueños y administradores de un negocio, para avisarles. */
export async function correosDeDuenos(workspaceId: string): Promise<string[]> {
  const filas = await prisma.workspaceMembership.findMany({
    where: { workspaceId, role: { in: ["WORKSPACE_OWNER", "WORKSPACE_ADMIN"] } },
    select: { user: { select: { email: true } } },
  });
  return filas.map((f) => f.user.email).filter(Boolean);
}
