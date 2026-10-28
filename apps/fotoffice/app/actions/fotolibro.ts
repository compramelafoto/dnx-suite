"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { templateV2EditorPath } from "@repo/template-editor-ui";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canDesignFotolibros } from "@/lib/fotolibro/acceso";
import { FOTOLIBROS_BASE_PATH } from "@/lib/fotolibro/constantes";
import { crearFotolibro } from "@/lib/fotolibro/crear";
import { leerFotolibroVendido } from "@/lib/fotolibro/venta";
import { crearFotolibroDeVenta } from "@/lib/fotolibro/venta-servidor";

export type NuevoFotolibroState = { error: string | null };

/** Crea el fotolibro y abre el editor en la primera hoja. */
export async function crearFotolibroAction(
  _prev: NuevoFotolibroState,
  formData: FormData,
): Promise<NuevoFotolibroState> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { error: "No hay una institución activa." };
  if (!(await canDesignFotolibros(user.id, workspace.id))) {
    return { error: "No tenés permiso para crear fotolibros: hace falta gestionar Fotolibros o Ventas." };
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

/**
 * «Crear fotolibro» en un renglón del Cobrador: el fotolibro vacío con lo elegido en la
 * calculadora. Al cobrar se ata al trabajo del pedido (`atarFotolibrosAlPedido`).
 */
export async function crearFotolibroDesdeCobradorAction(input: {
  eleccion: unknown;
  cliente: string | null;
}): Promise<{ ok: true; templateId: string; url: string } | { ok: false; error: string }> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { ok: false, error: "No hay una institución activa." };
  if (!(await canDesignFotolibros(user.id, workspace.id))) {
    return { ok: false, error: "No tenés permiso para crear fotolibros: hace falta gestionar Fotolibros o Ventas. Se crea solo al cobrar." };
  }
  const e = leerFotolibroVendido({ ...(input.eleccion as object), costoMinor: null, cajaCostoMinor: null, templateId: null });
  if (!e) return { ok: false, error: "Volvé a elegir el fotolibro en la calculadora." };
  const cliente = typeof input.cliente === "string" ? input.cliente.trim().slice(0, 120) || null : null;
  const r = await crearFotolibroDeVenta({ workspaceId: workspace.id, userId: user.id, eleccion: e, cliente });
  if (r.ok) revalidatePath(FOTOLIBROS_BASE_PATH);
  return r;
}
