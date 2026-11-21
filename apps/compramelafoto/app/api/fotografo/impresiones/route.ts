/**
 * GET /api/fotografo/impresiones → { paraImprimir, lotes, laboratorios } del panel «Impresiones».
 * Lotes sin anulados; los cerrados, sólo los últimos 30 días. Nunca el token del lote.
 */

import { NextResponse } from "next/server";
import { datosDelPanel } from "@/lib/print-batches/panel-del-fotografo";
import { fotografoDeLaSesion, responderError } from "@/lib/print-batches/ruta-del-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const yo = await fotografoDeLaSesion();
  if (yo instanceof NextResponse) return yo;
  try {
    return NextResponse.json(await datosDelPanel(yo.id), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return responderError("GET /api/fotografo/impresiones", err);
  }
}
