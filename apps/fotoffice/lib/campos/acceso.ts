import "server-only";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { puede } from "@/lib/access/policy";
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
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  if (!puede(role, "operar")) return null;
  const branding = await prisma.fotofficeWorkspaceBranding.findFirst({
    where: { workspaceId: workspace.id },
    select: { publicSlug: true },
  });
  return {
    workspaceId: workspace.id,
    workspaceSlug: branding?.publicSlug ?? "",
    userId: user.id,
    userLabel: etiquetaDeUsuario(user),
    role,
  };
}
