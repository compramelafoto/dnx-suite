import "server-only";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { resolveActiveWorkspace, type ActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { PORTFOLIO_MODULE_KEY } from "./constants";

export type PortfolioAdminContext = {
  user: AuthUser;
  workspace: ActiveWorkspace;
};

/**
 * Quién puede bajar un portfolio del sitio o publicarlo pese a la deuda: `portfolio` MANAGE
 * (roles etapa 2b). El nivel ya contempla el módulo apagado (NONE).
 *
 * Dueño y admin lo tienen siempre. **STAFF sin roles queda afuera** (compatibilidad NONE), igual
 * que antes: sacar la obra de alguien de la web de su institución es una decisión de conducción,
 * no una tarea de mostrador. Ahora la comisión puede dársela a alguien más con un rol.
 *
 * Devuelve `null` en lugar de redirigir, porque lo usan las acciones: un `redirect` dentro de una
 * server action convierte un "no tenés permiso" en una navegación que nadie pidió.
 */
export async function resolvePortfolioAdminContext(): Promise<PortfolioAdminContext | null> {
  const user = await getAuthUser();
  if (!user) return null;

  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;

  const level = await getModuleLevel(user.id, workspace.id, PORTFOLIO_MODULE_KEY);
  if (level !== "MANAGE") return null;

  return { user, workspace };
}
