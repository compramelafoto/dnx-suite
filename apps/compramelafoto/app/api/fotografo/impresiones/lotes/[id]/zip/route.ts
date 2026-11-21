/**
 * GET /api/fotografo/impresiones/lotes/:id/zip?parte=1
 *
 * ZIP de una parte del lote de impresión (de a 15 pedidos), para el fotógrafo dueño del lote.
 * Sólo las copias sueltas, ordenadas por tamaño y acabado (ver `lib/print-batches/zip-del-lote`).
 * No marca la descarga del laboratorio: eso lo hace la ruta del laboratorio.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { LoteError, loteDelFotografo } from "@/lib/print-batches/servicio";
import { nombreDeLaParte, partesDelLote, responderZipDeLaParte } from "@/lib/print-batches/zip-del-lote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// La función dura lo que tarda el ZIP en llegar (hasta 15 pedidos, ~300 MB).
export const maxDuration = 300;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }
    const batchId = Number((await ctx.params).id);
    if (!Number.isInteger(batchId) || batchId <= 0) {
      return NextResponse.json({ error: "Lote no encontrado." }, { status: 404 });
    }
    const parte = Number(req.nextUrl.searchParams.get("parte") ?? "1");
    if (!Number.isInteger(parte) || parte < 1) {
      return NextResponse.json({ error: "Esa parte del lote no existe." }, { status: 404 });
    }

    const lote = await loteDelFotografo(user.id, batchId);
    const total = partesDelLote(
      lote.entries.flatMap((e) => (e.albumOrderId != null ? [e.albumOrderId] : [])),
    ).length;
    if (parte > total) return NextResponse.json({ error: "Esa parte del lote no existe." }, { status: 404 });
    return await responderZipDeLaParte(batchId, parte, nombreDeLaParte(lote.nombre, parte, total));
  } catch (err: unknown) {
    if (err instanceof LoteError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error("ZIP LOTE IMPRESION ERROR >>>", err);
    return NextResponse.json({ error: "No se pudo armar el ZIP del lote. Probá de nuevo." }, { status: 500 });
  }
}
