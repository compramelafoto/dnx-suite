/**
 * GET /api/fotografo/impresiones/pedidos/:albumOrderId → { impresion: { texto, loteId } | null }
 * Para la ficha del pedido: en qué lote está y en qué estado. Sólo pedidos del fotógrafo.
 */

import { NextResponse } from "next/server";
import { impresionDelPedido } from "@/lib/print-batches/panel-del-fotografo";
import { fotografoDeLaSesion, idDeLaRuta, responderError } from "@/lib/print-batches/ruta-del-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const yo = await fotografoDeLaSesion();
  if (yo instanceof NextResponse) return yo;
  const albumOrderId = idDeLaRuta((await ctx.params).id);
  if (albumOrderId == null) return NextResponse.json({ impresion: null });
  try {
    return NextResponse.json({ impresion: await impresionDelPedido(yo.id, albumOrderId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return responderError(`GET /api/fotografo/impresiones/pedidos/${albumOrderId}`, err);
  }
}
