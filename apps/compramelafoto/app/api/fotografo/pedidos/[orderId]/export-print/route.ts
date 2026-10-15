/**
 * Export ZIP de la carpeta de impresión para un pedido de álbum (Order).
 * Solo ítems PRINT/FRAME, organizados por Producto/Acabado/Tamaño.
 * Requiere fotógrafo del álbum o admin. El armado vive en `lib/orders/print-export`.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { loadAlbumOrderPrintPlan } from "@/lib/orders/print-export/album-order-print-plan";
import { streamPrintExportZip } from "@/lib/orders/print-export/stream-print-export-zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Leer de R2 y mandar ~20 MB por pedido: sin tope explícito la función se cortaba a mitad
// del ZIP y la fotógrafa recibía un archivo que no abría.
export const maxDuration = 300;

export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }
    const { orderId } = await ctx.params;
    const id = Number(orderId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "ID de pedido inválido" }, { status: 400 });
    }
    const result = await loadAlbumOrderPrintPlan(id, user);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return streamPrintExportZip([result.plan], result.plan.folder);
  } catch (err: unknown) {
    console.error("EXPORT PRINT (album) ERROR >>>", err);
    return NextResponse.json(
      { error: "Error exportando carpeta de impresión", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
