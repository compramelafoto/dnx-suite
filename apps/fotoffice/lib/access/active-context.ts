import "server-only";
import { redirect } from "next/navigation";
import { requireAuth, type AuthUser } from "@/lib/auth";
import { resolveActiveWorkspace, type ActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";

/**
 * Sesión + workspace activo + rol, resueltos por el mismo camino que el menú lateral
 * (`(shell)/layout.tsx`): respeta la cookie del workspace elegido. Así Equipo y Módulos
 * actúan siempre sobre el workspace que la persona está viendo, no sobre el más antiguo.
 *
 * El workspace y el rol salen siempre de la sesión: nunca de un campo del formulario.
 * El chequeo de capacidad (`puede`) lo hace cada pantalla o acción.
 */
export async function requireActiveWorkspaceRole(): Promise<{
  user: AuthUser;
  workspace: ActiveWorkspace;
  role: string | null;
}> {
  const user = await requireAuth();
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) redirect("/workspace");
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  return { user, workspace, role };
}
