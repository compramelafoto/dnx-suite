import { NextResponse } from "next/server";
import { contextoEventos } from "@/lib/eventos/contexto";
import { AccreditationError } from "@/lib/eventos/acreditacion/errores";
import { acreditarConClave } from "@/lib/eventos/acreditacion/servicio";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Confirma la acreditación. `requestId` es la clave de idempotencia: repetirlo no duplica. */
export async function POST(req: Request, ctx: Ctx) {
  const c = await contextoEventos("MANAGE");
  if (!c) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id: eventoId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    inscriptoId?: string;
    requestId?: string;
    excepcion?: boolean;
    fuente?: string;
  };
  if (!body.inscriptoId || !body.requestId || !/^[A-Za-z0-9-]{8,80}$/.test(body.requestId)) {
    return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });
  }
  try {
    const r = await acreditarConClave({
      workspaceId: c.workspaceId,
      eventoId,
      inscriptoId: body.inscriptoId,
      userId: c.userId,
      clave: body.requestId,
      fuente: body.fuente === "QR" ? "QR" : "PUERTA",
      excepcion: body.excepcion === true,
    });
    return NextResponse.json(r, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AccreditationError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    throw error;
  }
}
