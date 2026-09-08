"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { sanitizeError } from "@/lib/payments/connect/log";
import { deleteIntegration } from "@/lib/integrations/store";
import { revokeIntegrationToken } from "@/lib/integrations/google-oauth";
import { getIntegrationDefinition } from "@/lib/integrations/registry";

const PANTALLA = "/workspace/configuracion/integraciones";

/**
 * Desconecta una cuenta.
 *
 * Borra la credencial primero y recién después le avisa a Google. Si el aviso falla, el
 * permiso queda vivo del lado de Google pero la plataforma ya no lo tiene: es el orden
 * correcto, porque el error que importa evitar es quedarse con una credencial que el dueño
 * pidió borrar.
 *
 * Lo ya creado con esa cuenta (por ejemplo, eventos en el calendario) NO se toca.
 */
export async function disconnectIntegrationAction(formData: FormData): Promise<void> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");

  const role = await resolveWorkspaceRole(user.id, workspace.id);
  if (!canManageWorkspaceSettings(role)) redirect(`${PANTALLA}?error=sin_permiso`);

  const key = String(formData.get("integrationKey") ?? "").trim();
  if (!getIntegrationDefinition(key)) redirect(`${PANTALLA}?error=integracion_desconocida`);

  try {
    const refreshToken = await deleteIntegration(workspace.id, key);
    if (refreshToken) await revokeIntegrationToken(refreshToken);
  } catch (error) {
    console.error("[fotoffice][integraciones] falló la desconexión", {
      workspaceId: workspace.id,
      integrationKey: key,
      detalle: sanitizeError(error),
    });
    redirect(`${PANTALLA}?error=no_se_pudo_desconectar`);
  }

  revalidatePath(PANTALLA);
  redirect(`${PANTALLA}?ok=desconectado`);
}
