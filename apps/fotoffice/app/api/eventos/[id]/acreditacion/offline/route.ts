import { NextResponse } from "next/server";
import { contextoEventos } from "@/lib/eventos/contexto";
import { AccreditationError } from "@/lib/eventos/acreditacion/errores";
import { procesarEscaneoOffline } from "@/lib/eventos/acreditacion/servicio";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Un escaneo que el celular guardó sin conexión y ahora sube. Se procesa en el momento y contesta
 * cómo quedó (SYNCED, CONFLICT o REJECTED); reenviarlo con la misma clave no duplica.
 */
export async function POST(req: Request, ctx: Ctx) {
  const c = await contextoEventos("MANAGE");
  if (!c) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id: eventoId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    idempotencyKey?: string;
    clientOccurredAt?: string;
    qr?: string;
    shortCode?: string;
    inscriptoIdHint?: string;
  };
  if (!body.idempotencyKey || !/^[A-Za-z0-9-]{8,80}$/.test(body.idempotencyKey) || !body.clientOccurredAt) {
    return NextResponse.json({ error: "INVALID_OFFLINE_PAYLOAD" }, { status: 400 });
  }
  const clientOccurredAt = new Date(body.clientOccurredAt);
  if (Number.isNaN(clientOccurredAt.getTime())) {
    return NextResponse.json({ error: "INVALID_OFFLINE_TIMESTAMP" }, { status: 400 });
  }
  try {
    const r = await procesarEscaneoOffline({
      workspaceId: c.workspaceId,
      eventoId,
      userId: c.userId,
      idempotencyKey: body.idempotencyKey,
      clientOccurredAt,
      qr: body.qr ?? null,
      shortCode: body.shortCode ?? null,
      inscriptoIdHint: body.inscriptoIdHint ?? null,
    });
    return NextResponse.json(r, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AccreditationError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    throw error;
  }
}
