import "server-only";
import { getAuthUser } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { QUOTES_MODULE_KEY, type CtxPresupuestos } from "./acceso";

/**
 * Guarda de las acciones y pantallas de Presupuestos, en este orden: sesión, workspace activo,
 * módulo `quotes` encendido y el nivel pedido ("ver" = Ver; "operar" = Gestionar).
 *
 * Devuelve null ante cualquier falta, sin decir el motivo y sin redirigir. El `workspaceId` sale
 * siempre de la sesión, nunca de lo que manda el navegador.
 */
export async function contextoDePresupuestos(nivel: "ver" | "operar"): Promise<CtxPresupuestos | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  if (!(await isModuleEnabledForWorkspace(workspace.id, QUOTES_MODULE_KEY))) return null;
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, nivel, QUOTES_MODULE_KEY)) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso };
}
