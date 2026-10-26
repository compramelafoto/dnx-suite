"use server";

import { revalidatePath } from "next/cache";
import { requireWebsiteContext } from "@/lib/workspace";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { publicarBorradoresImportados } from "@/lib/blog/importados";
import { BLOG_ADMIN_BASE } from "@/lib/blog/admin-nav";

export type PublicarImportadosState = { error: string | null; publicados?: number };

/** «Publicar contenido importado»: los artículos que trajo el importador de Alboom pasan a publicados. */
export async function publicarImportadosAction(_prev: PublicarImportadosState | undefined, _formData: FormData): Promise<PublicarImportadosState> {
  const { user, workspace } = await requireWebsiteContext();
  if (!(await hasModuleLevel(user.id, workspace.id, WEBSITE_MODULE_KEY, "MANAGE"))) {
    return { error: "No tenés permiso para editar el blog." };
  }
  const publicados = await publicarBorradoresImportados(workspace.id);
  revalidatePath(BLOG_ADMIN_BASE);
  return { error: null, publicados };
}
