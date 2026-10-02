import "server-only";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { resolveActiveWorkspace, type ActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { canManageMembers } from "@/lib/members/role-policy";
import { PORTFOLIO_MODULE_KEY } from "./constants";

export type PortfolioAdminContext = {
  user: AuthUser;
  workspace: ActiveWorkspace;
};

/**
 * Quién puede bajar un portfolio del sitio o publicarlo pese a la deuda.
 *
 * Mismo criterio que el padrón: OWNER o ADMIN. **STAFF queda afuera**, aunque pueda consultar la
 * lista: sacar la obra de alguien de la web de su institución es una decisión de conducción, no
 * una tarea de mostrador.
 *
 * Devuelve `null` en lugar de redirigir, porque lo usan las acciones: un `redirect` dentro de una
 * server action convierte un "no tenés permiso" en una navegación que nadie pidió.
 */
export async function resolvePortfolioAdminContext(): Promise<PortfolioAdminContext | null> {
  const user = await getAuthUser();
  if (!user) return null;

  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;

  if (!(await isModuleEnabledForWorkspace(workspace.id, PORTFOLIO_MODULE_KEY))) return null;

  const role = await resolveWorkspaceRole(user.id, workspace.id);
  if (!canManageMembers(role)) return null;

  return { user, workspace };
}
