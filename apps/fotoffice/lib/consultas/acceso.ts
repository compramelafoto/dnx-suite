import "server-only";
import { getAuthUser } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import type { CtxConsultas } from "./catalogo";

/**
 * Guarda de las acciones de Consultas (alta, alta rápida, edición de la ficha, participantes y el
 * buscador de contactos): sesión, workspace activo, módulo encendido y el nivel pedido en
 * Consultas (`service-leads`): "ver" = nivel Ver; "operar" = nivel Gestionar.
 *
 * Devuelve null ante cualquier falta, sin distinguir el motivo y sin redirigir. El `workspaceId`
 * sale siempre de la sesión: nunca de lo que manda el navegador.
 */
export async function contextoDeConsultas(nivel: "ver" | "operar"): Promise<CtxConsultas | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  if (!(await isModuleEnabledForWorkspace(workspace.id, SERVICE_LEADS_MODULE_KEY))) return null;
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, nivel, SERVICE_LEADS_MODULE_KEY)) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso };
}
