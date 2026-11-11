import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { isFullAccessRole } from "@/lib/permissions/levels";
import { LIVE_MODULE_KEY } from "./constantes";

/**
 * El panel de Transmisión en vivo: el módulo encendido y ser dueño o admin del negocio.
 *
 * No se delega con roles: el canal tiene la clave de OBS (quien la tiene transmite en nombre
 * del workspace) y cada minuto retransmitido cuesta.
 */
export async function requireLive() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const [modulo, membresia] = await Promise.all([
    isModuleEnabledForWorkspace(workspace.id, LIVE_MODULE_KEY),
    prisma.workspaceMembership.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
      select: { role: true },
    }),
  ]);
  if (!modulo || !isFullAccessRole(membresia?.role)) redirect("/dashboard");
  return { user, workspace };
}
