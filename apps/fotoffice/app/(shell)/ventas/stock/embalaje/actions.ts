"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSalesAdmin } from "@/lib/sales/access";
import { asegurarEnvoltoriosDeEjemplo, guardarEntregas, guardarEnvoltorio } from "@/lib/stock/embalaje-config";

const PANTALLA = "/ventas/stock/embalaje";

/**
 * Carga el sobre 19x24 y las bolsas negras. Configurar el embalaje es editar el catálogo
 * (`requireSalesAdmin`): decide qué se descuenta en cada venta.
 */
export async function cargarEnvoltoriosDeEjemploAction(): Promise<void> {
  const { workspace } = await requireSalesAdmin();
  const r = await asegurarEnvoltoriosDeEjemplo(workspace.id);
  revalidatePath(PANTALLA);
  redirect(`${PANTALLA}?ejemplo=${r.creados}`);
}

export async function guardarEnvoltorioAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSalesAdmin();
  const r = await guardarEnvoltorio(workspace.id, {
    insumoId: String(formData.get("insumoId") ?? ""),
    nombre: String(formData.get("nombre") ?? ""),
    tipo: String(formData.get("tipo") ?? ""),
    admiteAnchoCm: String(formData.get("admiteAnchoCm") ?? ""),
    admiteAltoCm: String(formData.get("admiteAltoCm") ?? ""),
    piezasPorUnidad: String(formData.get("piezasPorUnidad") ?? ""),
    activo: formData.get("activo") === "on",
  });
  if (!r.ok) redirect(`${PANTALLA}?error=${encodeURIComponent(r.error)}`);
  revalidatePath(PANTALLA);
  redirect(`${PANTALLA}?ok=1`);
}

/** Guarda la forma de entrega de los productos. La tabla la llama directo y muestra el resultado. */
export async function guardarEntregasAction(filas: unknown): Promise<{ ok: true; guardadas: number } | { ok: false; error: string }> {
  const { workspace } = await requireSalesAdmin();
  const r = await guardarEntregas(workspace.id, filas);
  if (r.ok) revalidatePath(PANTALLA);
  return r;
}
