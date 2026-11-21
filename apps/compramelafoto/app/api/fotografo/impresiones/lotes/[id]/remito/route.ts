/**
 * GET /api/fotografo/impresiones/lotes/:id/remito
 *
 * El remito del lote de impresión en PDF, para el fotógrafo dueño del lote.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { LoteError, loteDelFotografo } from "@/lib/print-batches/servicio";
import { remitoDelLote } from "@/lib/print-batches/impresos-del-lote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }
    const batchId = Number((await ctx.params).id);
    if (!Number.isInteger(batchId) || batchId <= 0) {
      return NextResponse.json({ error: "Lote no encontrado." }, { status: 404 });
    }
    const lote = await loteDelFotografo(user.id, batchId);
    const pdf = await remitoDelLote(batchId);
    if (!pdf) return NextResponse.json({ error: "Lote no encontrado." }, { status: 404 });
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Remito - ${encodeURIComponent(lote.nombre)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    if (err instanceof LoteError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error("REMITO LOTE ERROR >>>", err);
    return NextResponse.json({ error: "No se pudo armar el PDF. Probá de nuevo." }, { status: 500 });
  }
}
