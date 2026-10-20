import "server-only";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { GALLERY_MODULE_KEY, type CtxGalerias } from "./acceso";

export type ConfiguracionDeGalerias =
  | { estado: "SIN_PERMISO" }
  | { estado: "APAGADO" }
  | { estado: "LISTO"; ctx: CtxGalerias };

/**
 * Guarda de Configuración → Galería: `configurar` (dueño o administrador) antes de cualquier lectura,
 * después el módulo `gallery` encendido. Igual que `prepararConfiguracionContratos`.
 */
export async function prepararConfiguracionGalerias(): Promise<ConfiguracionDeGalerias> {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) return { estado: "SIN_PERMISO" };
  if (!(await isModuleEnabledForWorkspace(workspace.id, GALLERY_MODULE_KEY))) return { estado: "APAGADO" };
  const acceso = await resolverAcceso(user.id, workspace.id);
  return { estado: "LISTO", ctx: { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso } };
}
