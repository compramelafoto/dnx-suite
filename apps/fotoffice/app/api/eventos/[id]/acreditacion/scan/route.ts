import { NextResponse } from "next/server";
import { contextoEventos } from "@/lib/eventos/contexto";
import { AccreditationError } from "@/lib/eventos/acreditacion/errores";
import { buscarInscriptos, resolverPorCodigo, resolverPorId, resolverPorQr } from "@/lib/eventos/acreditacion/servicio";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const NO_CACHE = { "Cache-Control": "private, no-store" };

// Copiado del escáner de Clickatón: un celular que lee el mismo QR muchas veces por segundo no
// puede tirar la base. Por proceso, alcanza para la puerta.
const rate = new Map<string, { count: number; reset: number }>();

function rateLimit(key: string, max = 90) {
  const now = Date.now();
  const row = rate.get(key);
  if (!row || row.reset < now) {
    rate.set(key, { count: 1, reset: now + 60_000 });
    return true;
  }
  row.count += 1;
  return row.count <= max;
}

/** Lo que se leyó en la puerta: un QR, un código de 6 letras, un id ya elegido o una búsqueda. */
export async function POST(req: Request, ctx: Ctx) {
  const c = await contextoEventos("MANAGE");
  if (!c) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id: eventoId } = await ctx.params;
  if (!rateLimit(`${c.userId}:${eventoId}`)) {
    return NextResponse.json({ error: "RATE_LIMIT", message: "Demasiados escaneos seguidos. Esperá unos segundos." }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { qr?: string; shortCode?: string; inscriptoId?: string; q?: string };
  const base = { workspaceId: c.workspaceId, eventoId };
  try {
    if (body.qr) return NextResponse.json(await resolverPorQr({ ...base, qr: body.qr }), { headers: NO_CACHE });
    if (body.shortCode) return NextResponse.json(await resolverPorCodigo({ ...base, codigo: body.shortCode }), { headers: NO_CACHE });
    if (body.inscriptoId) return NextResponse.json(await resolverPorId({ ...base, inscriptoId: body.inscriptoId }), { headers: NO_CACHE });
    if (body.q?.trim()) return NextResponse.json({ candidatos: await buscarInscriptos({ ...base, q: body.q }) }, { headers: NO_CACHE });
    return NextResponse.json({ error: "QR_OR_CODE_REQUIRED" }, { status: 400 });
  } catch (error) {
    if (error instanceof AccreditationError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    throw error;
  }
}
