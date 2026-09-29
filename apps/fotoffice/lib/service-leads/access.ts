import "server-only";
import { redirect } from "next/navigation";
import { puede } from "@/lib/access/policy";
import { requireActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";

/**
 * Captación (formularios de pedidos de servicio): cualquiera del equipo que opera.
 * El Colaborador y quien no tiene rol en el workspace activo vuelven al panel.
 *
 * Sin workspace activo devuelve `workspace: null` como antes: las pantallas ya muestran
 * su propio aviso para ese caso.
 */
export async function requireServiceLeadsStaff() {
  const { user, workspace } = await requireActiveWorkspace();
  if (workspace) {
    const role = await resolveWorkspaceRole(user.id, workspace.id);
    if (!puede(role, "operar")) redirect("/dashboard");
  }
  return { user, workspace };
}
