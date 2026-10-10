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
 * `gallery` encendido y el nivel pedido ("ver" = Ver; "operar" = Gestionar). Null ante cualquier
 * falta, sin decir el motivo (igual que `contextoDeProyectos`).
 */
export async function contextoDeGalerias(nivel: "ver" | "operar"): Promise<CtxGalerias | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  if (!(await isModuleEnabledForWorkspace(workspace.id, GALLERY_MODULE_KEY))) return null;
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, nivel, GALLERY_MODULE_KEY)) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso };
}
