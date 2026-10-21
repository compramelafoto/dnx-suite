"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { templateV2EditorPath } from "@repo/template-editor-ui";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canDesignFotolibros } from "@/lib/fotolibro/acceso";
import { FOTOLIBROS_BASE_PATH } from "@/lib/fotolibro/constantes";
import { crearFotolibro } from "@/lib/fotolibro/crear";

export type NuevoFotolibroState = { error: string | null };

/** Crea el fotolibro y abre el editor en la primera hoja. */
export async function crearFotolibroAction(
  _prev: NuevoFotolibroState,
  formData: FormData,
): Promise<NuevoFotolibroState> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { error: "No hay una institución activa." };
  if (!(await canDesignFotolibros(user.id, workspace.id))) {
    return { error: "No tenés permiso para crear fotolibros: hace falta gestionar Ventas." };
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

  revalidatePath(FOTOLIBROS_BASE_PATH);
  redirect(templateV2EditorPath(FOTOLIBROS_BASE_PATH, r.templateId, r.versionId));
}
