"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSalesAdmin } from "@/lib/sales/access";
import { guardarEscala, guardarProduccion, type ProduccionVista } from "@/lib/impresion/configuracion";

export async function guardarEscalaAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSalesAdmin();
  const salidaId = String(formData.get("salidaId") ?? "");
  const r = await guardarEscala(workspace.id, salidaId, Number(String(formData.get("x")).replace(",", ".")), Number(String(formData.get("y")).replace(",", ".")));
  revalidatePath("/ventas/impresion/configuracion");
  redirect(`/ventas/impresion/configuracion?${r.ok ? "ok=1" : `error=${encodeURIComponent(r.error)}`}`);
}

export async function guardarProduccionAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSalesAdmin();
  const productId = String(formData.get("productId") ?? "");
  const activo = formData.get("activo") === "on";
  const datos: ProduccionVista | null = activo
    ? {
        tipoPieza: String(formData.get("tipoPieza")) as ProduccionVista["tipoPieza"],
        salidaId: String(formData.get("salidaId")),
        tamanoHojaId: String(formData.get("tamanoHojaId")),
        unidad: String(formData.get("unidad")) as ProduccionVista["unidad"],
      }
    : null;
  const r = await guardarProduccion(workspace.id, productId, datos);
  revalidatePath(`/ventas/catalogo/${productId}`);
  redirect(`/ventas/catalogo/${productId}?${r.ok ? "ok=1" : `error=${encodeURIComponent(r.error)}`}`);
}
