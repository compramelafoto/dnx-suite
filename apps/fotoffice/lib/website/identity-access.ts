import "server-only";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";

/**
 * Quién puede cambiar el logo y el favicon de la institución.
 *
 * Viven en `FotofficeWorkspaceBranding`, la misma fila que "Datos de la institución" (que es
 * Configuración y no se delega). El constructor del sitio los muestra por comodidad, pero
 * cambiarlos es cambiar la identidad de la institución en todos lados —el panel, el portal, los
 * correos—, no sólo en el sitio. Por eso exige dueño/admin aunque `website` MANAGE alcance para
 * los colores.
 */
export async function canEditWebsiteIdentity(userId: number, workspaceId: string): Promise<boolean> {
  return canManageWorkspaceSettings(await resolveWorkspaceRole(userId, workspaceId));
}
