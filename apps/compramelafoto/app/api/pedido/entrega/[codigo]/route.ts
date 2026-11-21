/**
 * QR del sobre de un pedido común: POST { accion: "LISTO" | "ENTREGADO" | "RECIBIDO_POR_CLIENTE" }.
 *
 * Acá se autoriza: `marcarListoParaRetirar` y `marcarEntregado` no miran quién llama.
 * - Fotógrafo dueño (sesión): «LISTO» (si lo retira él) y «ENTREGADO».
 * - Laboratorio del lote (cookie `lab_lote_<id>` del enlace, o su cuenta): «ENTREGADO», sólo si
 *   retira el cliente.
 * - Sin sesión (el cliente): «RECIBIDO_POR_CLIENTE» con el pedido «Listo para retirar».
 * Es un botón y no se marca al abrir el enlace: WhatsApp y los lectores de QR abren los enlaces solos.
 */

import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { LoteError, marcarEntregado, marcarListoParaRetirar } from "@/lib/print-batches/servicio";
import { actorParaElSobre, cargarSobre, esErrorDeSecreto } from "@/lib/print-batches/sobre-del-pedido";
import {
  CODIGO_INVALIDO,
  NO_PODES,
  accionesPermitidas,
  esAccionDelSobre,
  notaDelHistorial,
  textoDelEstadoDelPedido,
} from "@/lib/print-batches/entrega-del-pedido";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CABECERAS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
const ERROR_GENERICO = "No se pudo actualizar el pedido. Probá de nuevo.";

function responder(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: CABECERAS });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ codigo: string }> }) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip";
    const limite = checkRateLimit({ key: `pedido-entrega-qr:${ip}`, limit: 30, windowMs: 60_000 });
    if (!limite.allowed) return responder({ ok: false, error: "Demasiados intentos. Probá en un minuto." }, 429);

    const { codigo } = await ctx.params;
    const body = (await req.json().catch(() => null)) as { accion?: unknown } | null;
    const accion = body?.accion;
    if (!esAccionDelSobre(accion)) return responder({ ok: false, error: "Acción desconocida." }, 400);

    const sobre = await cargarSobre(decodeURIComponent(String(codigo || "")).trim());
    if (esErrorDeSecreto(sobre)) {
      console.error("PEDIDO ENTREGA QR >>> falta SCHOOL_DELIVERY_QR_SECRET / CRON_SECRET");
      return responder({ ok: false, error: ERROR_GENERICO }, 500);
    }
    if (!sobre) return responder({ ok: false, error: CODIGO_INVALIDO }, 404);

    const auth = await getAuthUser();
    const jar = await cookies();
    const actor = actorParaElSobre(sobre, auth, (n) => jar.get(n)?.value);
    const permitidas = accionesPermitidas({ actor, retiraCliente: sobre.retiraCliente, status: sobre.status });
    if (!permitidas.includes(accion)) return responder({ ok: false, error: NO_PODES }, 403);

    // La cuenta (fotógrafo o laboratorio) queda en el historial; el enlace del lab y el cliente, no.
    const userId = actor === "FOTOGRAFO" || actor === "LAB_CUENTA" ? auth?.id : undefined;
    const quien = { userId, nota: notaDelHistorial(actor, accion) };
    try {
      if (accion === "LISTO") await marcarListoParaRetirar(sobre.printOrderId, quien);
      else await marcarEntregado(sobre.printOrderId, quien);
    } catch (err) {
      if (err instanceof LoteError) return responder({ ok: false, error: err.message }, 409);
      throw err;
    }

    const po = await prisma.printOrder.findUnique({ where: { id: sobre.printOrderId }, select: { status: true } });
    const status = po?.status ?? sobre.status;
    return responder({ ok: true, status, textoDelEstado: textoDelEstadoDelPedido(status) });
  } catch (err) {
    console.error("PEDIDO ENTREGA QR ERROR >>>", err);
    return responder({ ok: false, error: ERROR_GENERICO }, 500);
  }
}
