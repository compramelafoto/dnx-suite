import { NextResponse } from "next/server";
import { requireDesignActor } from "@/lib/design-v2/http";
import { PASOS_CON_VUELTA, volverUnPaso } from "@/lib/design-v2/produccion";
import { listaDeIds, respuestaDeError } from "@/lib/design-v2/produccion-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST { desde, disenos, copias, items } — lleva al paso anterior las piezas elegidas que están en
 * `desde`. `disenos` son libritos, `copias` pedidos de canje de sólo copias e `items` ítems de la
 * tienda escolar. No manda correos.
 */
export async function POST(req: Request) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const desde = PASOS_CON_VUELTA.find((p) => p === body.desde);
    if (!desde) return NextResponse.json({ error: "Desde ese paso no se puede volver." }, { status: 400 });
    const piezas = { disenos: listaDeIds(body.disenos), copias: listaDeIds(body.copias), items: listaDeIds(body.items) };
    if (!piezas.disenos.length && !piezas.copias.length && !piezas.items.length) {
      return NextResponse.json({ error: "Elegí al menos un pedido." }, { status: 400 });
    }
    return NextResponse.json({ actualizados: await volverUnPaso(actor, desde, piezas) });
  } catch (err) {
    return respuestaDeError(err, "volver un paso");
  }
}
