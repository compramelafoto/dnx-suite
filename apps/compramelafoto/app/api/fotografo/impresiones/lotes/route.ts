/**
 * POST /api/fotografo/impresiones/lotes { albumOrderIds: number[], labContactId?: number | null }
 * → { batchId, nombre }. Arma un lote con pedidos de «Para imprimir» (ver `armarLote`).
 */

import { NextResponse } from "next/server";
import { armarLote } from "@/lib/print-batches/servicio";
import { fotografoDeLaSesion, leerCuerpo, responderError } from "@/lib/print-batches/ruta-del-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAXIMO = 500;

export async function POST(req: Request) {
  const yo = await fotografoDeLaSesion();
  if (yo instanceof NextResponse) return yo;
  const body = await leerCuerpo(req);
  const ids = body?.albumOrderIds;
  const lab = body?.labContactId ?? null;
  const valido = (x: unknown) => typeof x === "number" && Number.isSafeInteger(x) && x > 0;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAXIMO || !ids.every(valido) || (lab !== null && !valido(lab))) {
    return NextResponse.json({ error: "Elegí al menos un pedido." }, { status: 400 });
  }
  try {
    const r = await armarLote(yo.id, ids as number[], lab as number | null);
    return NextResponse.json(r, { status: 201 });
  } catch (err) {
    return responderError("POST /api/fotografo/impresiones/lotes", err);
  }
}
