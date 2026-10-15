import { NextResponse } from "next/server";
import { requireDesignActor } from "@/lib/design-v2/http";
import { marcarPaso, type PasoDeProduccion } from "@/lib/design-v2/produccion";
import { filtroDeLibritos, respuestaDeError } from "@/lib/design-v2/produccion-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PASOS: PasoDeProduccion[] = ["IMPRESO", "ENTREGADO", "VOLVER_A_IMPRIMIR"];

/** POST { ids | lote, paso } — marca impreso, entregado o lo saca del lote para reimprimir. */
export async function POST(req: Request) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const body = (await req.json().catch(() => ({}))) as { ids?: unknown; lote?: unknown; paso?: unknown };
    const paso = PASOS.find((p) => p === body.paso);
    if (!paso) return NextResponse.json({ error: "Paso desconocido." }, { status: 400 });
    const filtro = filtroDeLibritos(body);
    if (!filtro.ids && !filtro.lote) return NextResponse.json({ error: "Elegí al menos un librito." }, { status: 400 });
    return NextResponse.json({ actualizados: await marcarPaso(actor, filtro, paso) });
  } catch (err) {
    return respuestaDeError(err, "marcar paso");
  }
}
