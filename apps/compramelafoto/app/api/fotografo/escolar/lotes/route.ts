import { NextResponse } from "next/server";
import { requireDesignActor } from "@/lib/design-v2/http";
import { crearLote, listarLotes } from "@/lib/design-v2/produccion";
import { filtroDeLibritos, respuestaDeError } from "@/lib/design-v2/produccion-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — los lotes de impresión del fotógrafo, con cuántos van impresos y entregados. */
export async function GET() {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  try {
    return NextResponse.json({ lotes: await listarLotes(actor) });
  } catch (err) {
    return respuestaDeError(err, "listar lotes");
  }
}

/** POST { ids, copias } — manda a imprimir los librititos aprobados y los pedidos de sólo copias elegidos, en un lote nuevo. */
export async function POST(req: Request) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const { ids, copias } = filtroDeLibritos((await req.json().catch(() => ({}))) as { ids?: unknown; copias?: unknown });
    if (!ids?.length && !copias?.length) return NextResponse.json({ error: "Elegí al menos un pedido." }, { status: 400 });
    return NextResponse.json(await crearLote(actor, ids ?? [], copias ?? []));
  } catch (err) {
    return respuestaDeError(err, "crear lote");
  }
}
