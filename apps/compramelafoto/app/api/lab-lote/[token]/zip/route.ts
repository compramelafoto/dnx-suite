/**
 * GET /api/lab-lote/:token/zip?parte=1
 *
 * ZIP de una parte del lote (de a 15 pedidos) para el laboratorio con el enlace del lote, sin cuenta.
 * Mismo armado que el del fotógrafo (`lib/print-batches/zip-del-lote`). Marca la primera descarga
 * (`labDescargoAt`) cuando el ZIP sale bien. Token inválido o lote anulado: el 404 genérico.
 */

import { NextRequest, NextResponse } from "next/server";
import { loteDelLab, marcarDescargado } from "@/lib/print-batches/lote-del-lab";
import { ENLACE_INVALIDO } from "@/lib/print-batches/puerta-del-lab";
import { remitoDelLote } from "@/lib/print-batches/impresos-del-lote";
import { nombreDeLaParte, responderZipDeLaParte } from "@/lib/print-batches/zip-del-lote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// La función dura lo que tarda el ZIP en llegar (hasta 15 pedidos, ~300 MB).
export const maxDuration = 300;

const CABECERAS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
const responder = (body: unknown, status: number) => NextResponse.json(body, { status, headers: CABECERAS });

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const encontrado = await loteDelLab(token);
    if (!encontrado) return responder({ error: ENLACE_INVALIDO }, 404);
    const { batchId, lote } = encontrado;

    const parte = Number(req.nextUrl.searchParams.get("parte") ?? "1");
    if (!Number.isInteger(parte) || parte < 1 || parte > lote.partes) {
      return responder({ error: "Esa parte del lote no existe." }, 404);
    }
    const res = await responderZipDeLaParte(batchId, parte, nombreDeLaParte(lote.nombre, parte, lote.partes), async (p) => {
      // El remito es un archivo de control: si falla, el ZIP sale igual sin él.
      try {
        const remito = await remitoDelLote(batchId, p);
        return remito ? [{ name: "REMITO.pdf", content: remito }] : [];
      } catch (e) {
        console.error("REMITO DEL ZIP ERROR >>>", e);
        return [];
      }
    });
    if (res.ok) await marcarDescargado(batchId);
    for (const [k, v] of Object.entries(CABECERAS)) res.headers.set(k, v);
    return res;
  } catch (err) {
    console.error("LAB LOTE ZIP ERROR >>>", err);
    return responder({ error: "No se pudo armar el ZIP del lote. Probá de nuevo." }, 500);
  }
}
