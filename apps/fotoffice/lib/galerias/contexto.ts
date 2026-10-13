import "server-only";
import { getAuthUser } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { GALLERY_MODULE_KEY, type CtxGalerias } from "./acceso";

/**
 * Guarda de las acciones y rutas de Galería, en este orden: sesión, workspace activo, módulo
 * `gallery` encendido y el nivel pedido ("ver" = Ver; "operar" = Gestionar; "configurar" = dueño o
 * administrador, sin pedir además Ver en Galería: es lo mismo que mira la pantalla de Configuración).
 * Null ante cualquier falta, sin decir el motivo (igual que `contextoDeContratos`).
 */
export async function contextoDeGalerias(nivel: "ver" | "operar" | "configurar"): Promise<CtxGalerias | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  if (!(await isModuleEnabledForWorkspace(workspace.id, GALLERY_MODULE_KEY))) return null;
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (nivel === "configurar" ? !puede(acceso, "configurar") : !puede(acceso, nivel, GALLERY_MODULE_KEY)) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso };
}

/** ¿Está encendido el módulo en este workspace? (Para las pantallas que se muestran o no.) */
export function galeriasEncendidas(workspaceId: string): Promise<boolean> {
  return isModuleEnabledForWorkspace(workspaceId, GALLERY_MODULE_KEY);
}
