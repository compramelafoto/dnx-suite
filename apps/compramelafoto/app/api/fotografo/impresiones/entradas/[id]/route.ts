/**
 * POST /api/fotografo/impresiones/entradas/:id { motivo: "REIMPRIMIR" | "SACAR" }
 * Saca un pedido del lote (lote sin enviar) o lo manda a reimprimir (vuelve a «Para imprimir»).
 */

import { NextResponse } from "next/server";
import { quitarPedido } from "@/lib/print-batches/servicio";
import { fotografoDeLaSesion, idDeLaRuta, leerCuerpo, responderError } from "@/lib/print-batches/ruta-del-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const yo = await fotografoDeLaSesion();
  if (yo instanceof NextResponse) return yo;
  const entryId = idDeLaRuta((await ctx.params).id);
  if (entryId == null) return NextResponse.json({ error: "Ese pedido no está en el lote." }, { status: 404 });
  const motivo = (await leerCuerpo(req))?.motivo;
  if (motivo !== "REIMPRIMIR" && motivo !== "SACAR") return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  try {
    await quitarPedido(yo.id, entryId, motivo);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return responderError(`POST /api/fotografo/impresiones/entradas/${entryId}`, err);
  }
}
