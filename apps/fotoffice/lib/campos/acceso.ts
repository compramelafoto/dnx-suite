import "server-only";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { MODULOS_CRM } from "@/lib/access/modulos-crm";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import type { CtxCampos } from "./definiciones";

export type ContextoCampos = CtxCampos & {
  /** Slug público del workspace ("" si no tiene). Decide el campo inicial de DNX. */
  workspaceSlug: string;
};

/**
 * Guarda común de campos personalizados: sesión, workspace activo y rol con `operar` (quien
 * configura también opera). Devuelve null ante cualquier falta, sin distinguir el motivo, y
 * nunca redirige. El `workspaceId` sale siempre de la sesión. El módulo del tipo de registro
 * lo verifica cada acción, y `configurar` lo exige cada función de configuración.
 */
export async function contextoDeCampos(): Promise<ContextoCampos | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  const acceso = await resolverAcceso(user.id, workspace.id);
  // "Ver" en alguno de los módulos con campos: leer "Más datos" sigue al nivel de la ficha;
  // guardar valores exige `operar` sobre el módulo del registro, y configurar, dueño/admin.
  if (!puede(acceso, "ver", MODULOS_CRM) && !puede(acceso, "configurar")) return null;
  const branding = await prisma.fotofficeWorkspaceBranding.findFirst({
    where: { workspaceId: workspace.id },
    select: { publicSlug: true },
  });
  return {
    workspaceId: workspace.id,
    workspaceSlug: branding?.publicSlug ?? "",
    userId: user.id,
    userLabel: etiquetaDeUsuario(user),
    role: acceso.role,
    acceso,
  };
}
