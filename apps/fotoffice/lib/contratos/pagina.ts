import "server-only";
import { prisma } from "@repo/db";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { CONTRACTS_MODULE_KEY, type CtxContratos } from "./acceso";
import { asegurarPlantillaModeloDnx } from "./semillas";

export type ConfiguracionDeContratos =
  | { estado: "SIN_PERMISO" }
  | { estado: "APAGADO" }
  | { estado: "LISTO"; ctx: CtxContratos; workspaceName: string };

/**
 * Guarda de las pantallas de Configuración → Contratos: `configurar` (dueño o administrador) antes de
 * cualquier lectura, después el módulo `contracts` encendido. Con eso listo, siembra (sólo DNX) la
 * plantilla modelo y devuelve el contexto con el que leer.
 */
export async function prepararConfiguracionContratos(): Promise<ConfiguracionDeContratos> {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) return { estado: "SIN_PERMISO" };
  if (!(await isModuleEnabledForWorkspace(workspace.id, CONTRACTS_MODULE_KEY))) return { estado: "APAGADO" };
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId: workspace.id }, select: { publicSlug: true } });
  await asegurarPlantillaModeloDnx(workspace.id, branding?.publicSlug ?? "");
  const acceso = await resolverAcceso(user.id, workspace.id);
  const ctx: CtxContratos = { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso };
  return { estado: "LISTO", ctx, workspaceName: workspace.name };
}
