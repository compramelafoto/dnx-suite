/**
 * Puerta del laboratorio sin cuenta: el token del enlace del lote es la única credencial.
 *
 * GET  /api/lab-lote/:token  → datos del lote para el laboratorio. Marca la primera apertura
 *      (`labAbrioAt`) y deja la cookie `lab_lote_<id>` (la usa el QR del sobre). Se llama desde la
 *      página con JavaScript, así los escáneres de enlaces del correo no la cuentan como «abrió».
 * POST /api/lab-lote/:token  { hacia: "EN_PRODUCCION" | "LISTO" | "DESPACHADO" } → mueve el lote.
 *
 * Token inventado, de otro lote, mal escrito o de un lote anulado: el mismo 404, sin decir si existe.
 */

import { NextRequest, NextResponse } from "next/server";
import { hashDeToken } from "@/lib/print-batches/codigos";
import { LoteError, moverLote } from "@/lib/print-batches/servicio";
import { loteDelLab, marcarAbierto } from "@/lib/print-batches/lote-del-lab";
import {
  DURACION_COOKIE_S,
  ENLACE_INVALIDO,
  ERROR_CAMBIO_DE_ESTADO,
  esEstadoDelLab,
  nombreDeLaCookie,
} from "@/lib/print-batches/puerta-del-lab";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Mover un lote grande cambia y avisa pedido por pedido.
export const maxDuration = 300;

const CABECERAS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };

function responder(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: CABECERAS });
}
const enlaceInvalido = () => responder({ error: ENLACE_INVALIDO }, 404);

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const encontrado = await loteDelLab(token);
    if (!encontrado) return enlaceInvalido();
    await marcarAbierto(encontrado.batchId);
    const res = responder({ lote: encontrado.lote });
    res.cookies.set(nombreDeLaCookie(encontrado.batchId), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DURACION_COOKIE_S,
    });
    return res;
  } catch (err) {
    console.error("LAB LOTE GET ERROR >>>", err);
    return responder({ error: "No se pudo abrir el lote. Probá de nuevo." }, 500);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const encontrado = await loteDelLab(token);
    if (!encontrado) return enlaceInvalido();
    const body = (await req.json().catch(() => null)) as { hacia?: unknown } | null;
    const hacia = body?.hacia;
    if (!esEstadoDelLab(hacia)) return responder({ error: ERROR_CAMBIO_DE_ESTADO }, 400);
    try {
      await moverLote(encontrado.batchId, hacia, { tipo: "LABORATORIO", tokenHash: hashDeToken(token) });
    } catch (err) {
      if (err instanceof LoteError) return responder({ error: err.message }, 400);
      throw err;
    }
    const nuevo = await loteDelLab(token);
    if (!nuevo) return enlaceInvalido();
    return responder({ lote: nuevo.lote });
  } catch (err) {
    console.error("LAB LOTE POST ERROR >>>", err);
    return responder({ error: "No se pudo cambiar el estado. Probá de nuevo." }, 500);
  }
}
