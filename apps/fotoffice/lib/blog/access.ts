import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { requireWebsiteContext, resolveActiveWorkspace, type ActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";

/**
 * Quién puede escribir en el blog de la institución.
 *
 * El blog es una sección del módulo Sitio web: misma llave de módulo y mismo permiso que editar
 * el sitio (dueño o administrador de la institución). El resto del equipo no edita lo que se
 * publica en nombre de la institución.
 */
export type BlogEditorContext = { user: AuthUser; workspace: ActiveWorkspace };

async function rolEn(userId: number, workspaceId: string) {
  const m = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { role: true },
  });
  return m?.role ?? null;
}

/** Para pantallas: sin módulo o sin permiso, afuera (con `redirect`). */
export async function requireBlogEditor(): Promise<BlogEditorContext> {
  const { user, workspace } = await requireWebsiteContext();
  if (!canManageWorkspaceSettings(await rolEn(user.id, workspace.id))) redirect("/website");
  return { user, workspace };
}

export type BlogApiGuard =
  | { ctx: BlogEditorContext; response: null }
  | { ctx: null; response: NextResponse };

/** Para rutas de API: devuelve la respuesta de error en vez de redirigir. */
export async function requireBlogEditorApi(): Promise<BlogApiGuard> {
  const user = await getAuthUser();
  if (!user) {
    return { ctx: null, response: NextResponse.json({ error: "Iniciá sesión." }, { status: 401 }) };
  }
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace || !(await isModuleEnabledForWorkspace(workspace.id, WEBSITE_MODULE_KEY))) {
    return {
      ctx: null,
      response: NextResponse.json({ error: "El sitio web no está habilitado." }, { status: 403 }),
    };
  }
  if (!canManageWorkspaceSettings(await rolEn(user.id, workspace.id))) {
    return {
      ctx: null,
      response: NextResponse.json(
        { error: "Sólo el dueño o un administrador de la institución edita el blog." },
        { status: 403 },
      ),
    };
  }
  return { ctx: { user, workspace }, response: null };
}

export function parseRouteId(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}
