"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { TEMPLATE_V2_BASE_PATHS, templateV2EditorPath } from "@repo/template-editor-ui";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canDesignTemplates } from "@/lib/template-v2/access";
import { crearFotolibro } from "@/lib/fotolibro/crear";

export type NuevoFotolibroState = { error: string | null };

/** Crea el fotolibro y abre el editor en la primera hoja. */
export async function crearFotolibroAction(
  _prev: NuevoFotolibroState,
  formData: FormData,
): Promise<NuevoFotolibroState> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { error: "No hay una institución activa." };
  if (!(await canDesignTemplates(user.id, workspace.id))) {
    return { error: "No tenés permiso para crear plantillas: hace falta gestionar Socios." };
  }

  const r = await crearFotolibro({
    workspaceId: workspace.id,
    userId: user.id,
    medidaId: String(formData.get("medidaId") ?? ""),
    hojas: Number(formData.get("hojas") ?? 0),
    proveedorId: String(formData.get("proveedorId") ?? "").trim() || null,
    nombre: String(formData.get("nombre") ?? "") || null,
  });
  if (!r.ok) return { error: r.error };

  revalidatePath("/members/disenador");
  redirect(templateV2EditorPath(TEMPLATE_V2_BASE_PATHS.fotoffice, r.templateId, r.versionId));
}
