import "server-only";
import { getAuthUser } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import type { CtxContacto } from "./perfil";

/**
 * Guarda de las acciones sobre los datos del contacto (perfil ampliado): sesión, workspace
 * activo, módulo de Clientes encendido y el nivel pedido en Clientes ("ver" = Ver; "operar" =
 * Gestionar). Devuelve null ante cualquier falta, sin distinguir el motivo. El `workspaceId`
 * sale siempre de la sesión.
 */
export async function contextoDeContactos(nivel: "ver" | "operar"): Promise<CtxContacto | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  if (!(await isModuleEnabledForWorkspace(workspace.id, CLIENTS_MODULE_KEY))) return null;
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, nivel, CLIENTS_MODULE_KEY)) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso };
}
