"use server";

import { revalidatePath } from "next/cache";
import { requireSalesAdmin } from "@/lib/sales/access";
import type { LineaReceta } from "@/lib/stock/receta";
import { guardarReceta, sugerirDesdeImpresion } from "@/lib/stock/receta-servidor";

export type RecetaActionResult = { ok: true } | { ok: false; error: string };

export async function guardarRecetaAction(productId: string, lineas: LineaReceta[]): Promise<RecetaActionResult> {
  const { workspace } = await requireSalesAdmin();
  const r = await guardarReceta(workspace.id, productId, lineas);
  if (r.ok) revalidatePath(`/ventas/catalogo/${productId}`);
  return r;
}

/** No guarda: devuelve las líneas para precargar el formulario. */
export async function sugerirRecetaAction(productId: string, piezasPorHoja: number): Promise<LineaReceta[]> {
  const { workspace } = await requireSalesAdmin();
  return sugerirDesdeImpresion(workspace.id, productId, piezasPorHoja);
}
