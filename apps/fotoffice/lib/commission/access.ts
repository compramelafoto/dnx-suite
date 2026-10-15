import "server-only";
import { redirect } from "next/navigation";
import { requireAuth, type AuthUser } from "@/lib/auth";
import { requireOwnWorkspace } from "@/lib/entrada/require-own-workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";

export const COMMISSION_FORBIDDEN_REDIRECT = "/workspace/configuracion";

/**
 * Quien administra la Comisión directiva: dueño o admin del workspace propio. Cualquier otro
 * vuelve a Configuración.
 *
 * Es la primera línea de cada pantalla y de cada acción de la comisión: una server action es
 * alcanzable por POST directo, así que esconder los botones no alcanza. `redirect` corta igual
 * en un render que en una acción.
 */
export async function requireCommissionAdmin(): Promise<{ user: AuthUser; workspaceId: string }> {
  const user = await requireAuth();
  const { workspaceId } = await requireOwnWorkspace(user);
  const role = await resolveWorkspaceRole(user.id, workspaceId);
  if (!canManageWorkspaceSettings(role)) redirect(COMMISSION_FORBIDDEN_REDIRECT);
  return { user, workspaceId };
}
