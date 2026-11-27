"use server";

import { redirect } from "next/navigation";
import { AVISOS_OK, codigoDeError, type CodigoError, type CodigoOk } from "@/lib/avisos";
import { requireLevel } from "@/lib/guards";
import { hasRated, rateSale } from "@/lib/ventas/calificaciones";
import { estadoCalificacion } from "@/lib/ventas/estado";
import { VentaError, confirmPurchase, declinePurchase, getSaleForParty } from "@/lib/ventas/ventas";

/**
 * Acciones del comprador (confirmar o rechazar) y de las dos partes (calificar). Vuelven a la
 * pantalla con `?ok=CODIGO` / `?error=CODIGO`: nunca viaja texto por la URL.
 */

function idDe(fd: FormData): number {
  const v = fd.get("saleId");
  return Number(typeof v === "string" ? v.trim() : "");
}

async function run(volver: string, fn: () => Promise<CodigoOk | CodigoError>): Promise<never> {
  let query: string;
  try {
    const r = await fn();
    query = Object.prototype.hasOwnProperty.call(AVISOS_OK, r) ? `ok=${r}` : `error=${r}`;
  } catch (err) {
    query = `error=${codigoDeError(err, { noEncontrado: "NO_ENCONTRADA_VENTA", origen: "compras" })}`;
  }
  redirect(`${volver}?${query}`);
}

export async function confirmarCompra(formData: FormData) {
  const saleId = idDe(formData);
  const volver = `/compras/${saleId}`;
  const user = await requireLevel("identidad", volver);
  await run(volver, async () => {
    await confirmPurchase(user.id, saleId);
    return "COMPRA_CONFIRMADA";
  });
}

export async function rechazarCompra(formData: FormData) {
  const saleId = idDe(formData);
  const volver = `/compras/${saleId}`;
  const user = await requireLevel("identidad", volver);
  await run(volver, async () => {
    await declinePurchase(user.id, saleId);
    return "COMPRA_RECHAZADA";
  });
}

/** Comprador o vendedor califican a la otra parte; cada uno vuelve a su propia pantalla. */
export async function calificar(formData: FormData) {
  const saleId = idDe(formData);
  const user = await requireLevel("identidad", `/compras/${saleId}`);
  const sale = Number.isInteger(saleId) ? await getSaleForParty(user.id, saleId) : null;
  if (!sale) redirect(`/compras?error=NO_ENCONTRADA_VENTA`);
  const volver = sale.rol === "COMPRADOR" ? `/compras/${saleId}` : `/ventas/${saleId}`;
  await run(volver, async () => {
    // `rateSale` responde igual a «no confirmada» y «plazo vencido»: el motivo se decide acá.
    const estado = estadoCalificacion(sale, await hasRated(user.id, saleId));
    if (estado === "YA_CALIFICASTE") return "YA_CALIFICASTE";
    if (estado === "VENCIDO") return "PLAZO_CALIFICAR";
    if (estado === "NO_CORRESPONDE") return "CALIFICAR_SIN_CONFIRMAR";
    const score = Number(formData.get("score"));
    const comment = formData.get("comment");
    try {
      await rateSale(user.id, saleId, score, typeof comment === "string" ? comment : undefined);
    } catch (err) {
      // El plazo pudo vencer entre la lectura y el guardado: nunca «ya no está pendiente».
      if (err instanceof VentaError && err.code === "NO_PENDIENTE") return "PLAZO_CALIFICAR";
      throw err;
    }
    return "CALIFICACION_GUARDADA";
  });
}
