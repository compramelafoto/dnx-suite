/**
 * Export endpoint para pedidos de impresión.
 * Devuelve un ZIP con la carpeta organizada para impresión (Producto/Acabado/Tamaño/archivos).
 * Requiere que el usuario sea el fotógrafo o el laboratorio del pedido (o admin).
 * El armado vive en `lib/orders/print-export`.
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { loadPrintOrderPrintPlan } from "@/lib/orders/print-export/print-order-print-plan";
import { streamPrintExportZip } from "@/lib/orders/print-export/stream-print-export-zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const orderId = Number(Array.isArray(id) ? id[0] : id);
    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: "No tenés permiso para descargar este pedido. Iniciá sesión como fotógrafo o laboratorio del pedido." },
        { status: 403 }
      );
    }
    const result = await loadPrintOrderPrintPlan(orderId, user);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return streamPrintExportZip([result.plan], result.plan.folder);
  } catch (err: unknown) {
    console.error("EXPORT ERROR >>>", err);
    return NextResponse.json(
      { error: "Error exportando pedido", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
