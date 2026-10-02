import "server-only";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { puede } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import type { CtxPlantillas } from "./definiciones";

export type ContextoPlantillas = CtxPlantillas & {
  /** Slug público del workspace ("" si no tiene). Decide las plantillas iniciales de DNX. */
  workspaceSlug: string;
  /** Nombre y correo de quien envía, para `[usuario_nombre]` y `[usuario_email]`. */
  userName: string | null;
  userEmail: string | null;
};

/**
 * Guarda común de plantillas y mensajes: sesión, workspace activo y rol con `operar` (usar
 * plantillas y enviar; quien configura también opera). Devuelve null ante cualquier falta, sin
 * distinguir el motivo, y nunca redirige. El `workspaceId` sale siempre de la sesión. `configurar`
 * lo exige cada función de configuración.
 */
export async function contextoDePlantillas(): Promise<ContextoPlantillas | null> {
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
    userName: user.name?.trim() || null,
    userEmail: user.email?.trim() || null,
    role,
  };
}
