import "server-only";
import { getAuthUser } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { BANDEJA_MODULE_KEY } from "./constantes";
import type { CtxBandeja } from "./acceso";

/**
 * Guarda de las acciones y pantallas de la Bandeja, en este orden: sesión, workspace activo, módulo
 * `whatsapp-inbox` encendido y el nivel pedido ("ver" = Ver; "operar" = Gestionar; "configurar" =
 * dueño o administrador). Devuelve null ante cualquier falta, sin decir el motivo. El `workspaceId`
 * y el usuario salen siempre de la sesión, nunca de lo que manda el navegador.
 */
export async function contextoDeBandeja(nivel: "ver" | "operar" | "configurar"): Promise<CtxBandeja | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  if (!(await isModuleEnabledForWorkspace(workspace.id, BANDEJA_MODULE_KEY))) return null;
  const acceso = await resolverAcceso(user.id, workspace.id);
  const permitido = nivel === "configurar" ? puede(acceso, "configurar") : puede(acceso, nivel, BANDEJA_MODULE_KEY);
  if (!permitido) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso };
}
