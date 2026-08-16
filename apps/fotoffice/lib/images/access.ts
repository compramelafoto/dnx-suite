import { prisma } from "@repo/db";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { resolveActiveWorkspace, type ActiveWorkspace } from "@/lib/workspace";

/**
 * Misma política que Members (OWNER/ADMIN gestionan, el resto solo consulta):
 * subir/reemplazar imágenes institucionales es una acción de administración
 * del workspace, no algo que cualquier miembro pueda hacer.
 */
export function canManageWorkspaceImages(role: string | null | undefined): boolean {
  return role === "WORKSPACE_OWNER" || role === "WORKSPACE_ADMIN" || role === "ADMIN";
}

export type ImageUploadContext = { user: AuthUser; workspace: ActiveWorkspace };

/**
 * Resuelve auth + workspace activo y exige OWNER/ADMIN. Se usa desde la API
 * route de upload — nunca confía en un workspaceId que mande el cliente.
 * Devuelve `null` (no redirect: `redirect()` no es seguro fuera de Server
 * Components/Actions, y quien llama acá es una API route) para que el
 * caller decida el status HTTP.
 */
export async function requireImageUploadContext(): Promise<ImageUploadContext | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;

  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    select: { role: true },
  });
  if (!canManageWorkspaceImages(membership?.role)) return null;

  return { user, workspace };
}
