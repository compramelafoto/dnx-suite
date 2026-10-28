"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { templateV2EditorPath } from "@repo/template-editor-ui";
import { requireAuth } from "@/lib/auth";
import { crearFotolibro } from "@/lib/fotolibro/crear";
import { MENSAJE_TOPE_FOTOLIBROS_SOCIO, RUTA_FOTOLIBROS_SOCIO } from "@/lib/fotolibro/constantes";
import { accesoFotolibrosSocio, llegoAlTopeDeFotolibros } from "@/lib/fotolibro/socio";
import type { NuevoFotolibroState } from "@/app/actions/fotolibro";

/** Crea un fotolibro personal del socio (sin institución) y abre el editor. */
export async function crearFotolibroSocioAction(
  _prev: NuevoFotolibroState,
  formData: FormData,
): Promise<NuevoFotolibroState> {
  const user = await requireAuth();
  if (!(await accesoFotolibrosSocio(user.id))) {
    return { error: "Tu institución no tiene los fotolibros encendidos para socios." };
  }
  if (await llegoAlTopeDeFotolibros(user.id)) return { error: MENSAJE_TOPE_FOTOLIBROS_SOCIO };
  const r = await crearFotolibro({
    workspaceId: null,
    userId: user.id,
    medidaId: String(formData.get("medidaId") ?? ""),
    hojas: Number(formData.get("hojas") ?? 0),
    proveedorId: null,
    nombre: String(formData.get("nombre") ?? "") || null,
  });
  if (!r.ok) return { error: r.error };

  revalidatePath(RUTA_FOTOLIBROS_SOCIO);
  redirect(templateV2EditorPath(RUTA_FOTOLIBROS_SOCIO, r.templateId, r.versionId));
}
