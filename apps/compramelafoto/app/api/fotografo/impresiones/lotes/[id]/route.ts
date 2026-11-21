/**
 * POST /api/fotografo/impresiones/lotes/:id — acciones del fotógrafo dueño sobre un lote:
 * - { accion: "ENVIAR", labContactId, mensaje?, entregaPreferida, fechaPrometida? ("aaaa-mm-dd") }
 * - { accion: "MOVER", hacia } (siempre hacia adelante; lo valida `moverLote`)
 * - { accion: "DESHACER" } (sólo un lote sin enviar)
 * - { accion: "PAGADO_AL_LAB" } (sólo un registro; el dinero va por fuera; repetirlo no cambia nada)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deshacerLote, enviarLote, loteDelFotografo, LoteError, LoteNoEncontrado, moverLote } from "@/lib/print-batches/servicio";
import { leerFechaPrometida } from "@/lib/print-batches/panel";
import type { EstadoLote } from "@/lib/print-batches/reglas";
import { fotografoDeLaSesion, idDeLaRuta, leerCuerpo, responderError } from "@/lib/print-batches/ruta-del-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Enviar revisa en R2 que estén todas las fotos del lote y mover un lote grande avisa pedido por pedido.
export const maxDuration = 300;

// «Cerrado» no se pide: el lote se cierra solo cuando se entregó todo.
const ESTADOS: readonly EstadoLote[] = ["EN_PRODUCCION", "LISTO", "DESPACHADO", "RECIBIDO"];
const MAX_MENSAJE = 2000;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const yo = await fotografoDeLaSesion();
  if (yo instanceof NextResponse) return yo;
  const batchId = idDeLaRuta((await ctx.params).id);
  if (batchId == null) return NextResponse.json({ error: "Lote no encontrado." }, { status: 404 });
  const body = await leerCuerpo(req);
  const invalido = (error = "Datos inválidos.") => NextResponse.json({ error }, { status: 400 });
  if (!body) return invalido();

  try {
    // Este panel sólo maneja lotes de pedidos comunes; uno ajeno o de otro tipo es «no encontrado».
    const lote = await loteDelFotografo(yo.id, batchId);
    if (lote.tipo !== "COMUNES") throw new LoteNoEncontrado("Lote no encontrado.");
    switch (body.accion) {
      case "ENVIAR": {
        const labContactId = body.labContactId;
        if (typeof labContactId !== "number" || !Number.isSafeInteger(labContactId) || labContactId <= 0) return invalido("Elegí el laboratorio.");
        const entrega = body.entregaPreferida;
        if (entrega !== "RETIRA_FOTOGRAFO" && entrega !== "ENVIA_LAB") return invalido("Elegí cómo te lo entregan.");
        if (body.mensaje != null && typeof body.mensaje !== "string") return invalido();
        const mensaje = typeof body.mensaje === "string" ? body.mensaje.trim() : "";
        if (mensaje.length > MAX_MENSAJE) return invalido("El mensaje es demasiado largo.");
        const fecha = leerFechaPrometida(body.fechaPrometida);
        if (fecha === "invalida") return invalido("La fecha prometida no es válida.");
        await enviarLote(yo.id, batchId, { labContactId, mensaje: mensaje || undefined, entregaPreferida: entrega, fechaPrometida: fecha ?? undefined });
        break;
      }
      case "MOVER": {
        const hacia = body.hacia;
        if (typeof hacia !== "string" || !(ESTADOS as readonly string[]).includes(hacia)) return invalido("Ese cambio de estado no se puede hacer.");
        await moverLote(batchId, hacia as EstadoLote, { tipo: "FOTOGRAFO", userId: yo.id });
        break;
      }
      case "DESHACER":
        await deshacerLote(yo.id, batchId);
        break;
      case "PAGADO_AL_LAB": {
        if (lote.estado === "ARMADO" || lote.estado === "ANULADO") throw new LoteError("El lote todavía no salió.");
        await prisma.printBatch.updateMany({
          where: { id: batchId, photographerId: yo.id, pagadoAlLabAt: null },
          data: { pagadoAlLabAt: new Date() },
        });
        break;
      }
      default:
        return invalido("Acción desconocida.");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return responderError(`POST /api/fotografo/impresiones/lotes/${batchId}`, err);
  }
}
