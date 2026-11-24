/**
 * POST /api/fotografo/impresiones/entradas/:id
 * - { motivo: "SACAR" } (o "REIMPRIMIR", el nombre viejo): saca un pedido sin entregar del lote, en
 *   cualquier estado salvo cerrado; vuelve a «Para imprimir» y, si el lote está en el laboratorio,
 *   se le avisa por correo.
 * - { accion: "ENTREGADO" }: el fotógrafo marca entregado el pedido (columna «Listos para entregar»).
 *   Sólo una entrada viva de un lote suyo que ya salió; si no, 404.
 */

import { NextResponse } from "next/server";
import { entregarDesdeElPanel, quitarPedido } from "@/lib/print-batches/servicio";
import { fotografoDeLaSesion, idDeLaRuta, leerCuerpo, responderError } from "@/lib/print-batches/ruta-del-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const yo = await fotografoDeLaSesion();
  if (yo instanceof NextResponse) return yo;
  const entryId = idDeLaRuta((await ctx.params).id);
  if (entryId == null) return NextResponse.json({ error: "Ese pedido no está en el lote." }, { status: 404 });
  const body = await leerCuerpo(req);
  const motivo = body?.motivo;
  const entregar = body?.accion === "ENTREGADO";
  if (!entregar && motivo !== "REIMPRIMIR" && motivo !== "SACAR") return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  try {
    if (entregar) await entregarDesdeElPanel(yo.id, entryId);
    else await quitarPedido(yo.id, entryId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return responderError(`POST /api/fotografo/impresiones/entradas/${entryId}`, err);
  }
}
