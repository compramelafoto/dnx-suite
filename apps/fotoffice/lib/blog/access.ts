import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getAuthUser, type AuthUser } from "@/lib/auth";
import { requireWebsiteContext, resolveActiveWorkspace, type ActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";

/**
 * Quién puede escribir en el blog de la institución.
 *
 * El blog es una sección del módulo Sitio web: misma llave de módulo y mismo nivel que editar
 * el sitio (`website` MANAGE: dueño, administrador o un rol con ese nivel).
 */
export type BlogEditorContext = { user: AuthUser; workspace: ActiveWorkspace };

/** Para pantallas: sin módulo o sin permiso, afuera (con `redirect`). */
export async function requireBlogEditor(): Promise<BlogEditorContext> {
  const { user, workspace } = await requireWebsiteContext();
  if (!(await hasModuleLevel(user.id, workspace.id, WEBSITE_MODULE_KEY, "MANAGE"))) redirect("/website");
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
  if (!(await hasModuleLevel(user.id, workspace.id, WEBSITE_MODULE_KEY, "MANAGE"))) {
    return {
      ctx: null,
      response: NextResponse.json(
        { error: "No tenés permiso para editar el blog." },
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
