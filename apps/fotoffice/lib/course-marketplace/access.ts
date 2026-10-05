import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireActiveWorkspace } from "@/lib/workspace";
import { isFullAccessRole } from "@/lib/permissions/levels";

/**
 * Sólo el dueño o un admin del negocio acepta ser beneficiario: es un compromiso de cobro.
 * No exige el módulo de cursos: un docente puede no venderlos él mismo.
 */
export async function requireDuenoOAdminDelNegocio() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/dashboard");
  const membresia = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    select: { role: true },
  });
  if (!isFullAccessRole(membresia?.role)) redirect("/dashboard");
  return { user, workspace };
}

export { invitacionesPendientesWhere } from "./invitaciones";
