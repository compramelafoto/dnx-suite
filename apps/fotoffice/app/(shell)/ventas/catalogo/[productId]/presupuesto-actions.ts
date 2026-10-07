"use server";

import { revalidatePath } from "next/cache";
import { requireSalesAdmin } from "@/lib/sales/access";
import { parseArsToMinor } from "@/lib/membership/money";
import { guardarPerfil } from "@/lib/catalogo/perfil";
import { guardarComponentes } from "@/lib/catalogo/combos";
import { guardarCostos } from "@/lib/catalogo/costos";

/**
 * Las tres secciones que la ficha del producto suma para presupuestos (etapa 2): "Combo",
 * "Costos" y "Para presupuestos".
 *
 * Todas exigen `sales.catalog` (`requireSalesAdmin`), igual que el resto de la ficha: tocan
 * precios armados y costos. El `workspaceId` sale de la sesión; cada id que llega del navegador
 * se valida contra ese workspace en `lib/catalogo/*`.
 *
 * Devuelven un resultado en vez de redirigir, como las de la tienda: la ficha guarda sección por
 * sección sin perder lo que se está escribiendo en las otras.
 */

export type CatalogoActionResult = { ok: true } | { ok: false; error: string };

function refrescar(productId: string) {
  revalidatePath("/ventas/catalogo");
  revalidatePath(`/ventas/catalogo/${productId}`);
}

export async function guardarPerfilAction(productId: string, formData: FormData): Promise<CatalogoActionResult> {
  const { workspace } = await requireSalesAdmin();
  const r = await guardarPerfil(workspace.id, String(productId), {
    // Casilla con respaldo oculto DESPUÉS: `get` devuelve la primera coincidencia.
    inPriceList: formData.get("inPriceList") === "on",
    incomeLabel: formData.get("incomeLabel"),
  });
  if (r.ok) refrescar(productId);
  return r;
}

export async function guardarComboAction(
  productId: string,
  componentes: { productId: string; quantity: number }[],
): Promise<CatalogoActionResult> {
  const { workspace } = await requireSalesAdmin();
  if (!Array.isArray(componentes)) return { ok: false, error: "Los componentes no son válidos." };
  const r = await guardarComponentes(
    workspace.id,
    String(productId),
    componentes.map((c) => ({ productId: String(c?.productId ?? ""), quantity: Number(c?.quantity) })),
  );
  if (r.ok) refrescar(productId);
  return r;
}

export type CostoFormulario = {
  supplierClientId: string;
  concept: string;
  /** Como lo escribe la gente: "3.000,50". */
  amount: string;
  perUnit: boolean;
  daysFromEvent: string;
};

export async function guardarCostosAction(productId: string, costos: CostoFormulario[]): Promise<CatalogoActionResult> {
  const { workspace } = await requireSalesAdmin();
  if (!Array.isArray(costos)) return { ok: false, error: "Los costos no son válidos." };
  const filas: unknown[] = [];
  for (const [i, c] of costos.entries()) {
    const importe = parseArsToMinor(String(c?.amount ?? ""));
    if (importe === null) return { ok: false, error: `Fila ${i + 1}: falta el importe.` };
    const diasTexto = String(c?.daysFromEvent ?? "").trim();
    const dias = diasTexto === "" ? 0 : Number(diasTexto);
    filas.push({
      supplierClientId: c?.supplierClientId ? String(c.supplierClientId) : null,
      concept: String(c?.concept ?? ""),
      amountMinor: importe,
      perUnit: c?.perUnit === true,
      daysFromEvent: dias,
    });
  }
  const r = await guardarCostos(workspace.id, String(productId), filas);
  if (r.ok) refrescar(productId);
  return r;
}
