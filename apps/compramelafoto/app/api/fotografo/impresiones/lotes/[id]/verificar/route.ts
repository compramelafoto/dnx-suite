/**
 * GET /api/fotografo/impresiones/lotes/:id/verificar
 *
 * «Verificar lote»: lo que recibe el laboratorio, archivo por archivo, armado igual que el ZIP
 * (mismos planes, mismo orden por tamaño, mismos nombres; ver `lib/orders/print-export/verificacion`).
 * Sólo para el fotógrafo dueño del lote. No marca nada: es una consulta.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { LoteError, loteDelFotografo } from "@/lib/print-batches/servicio";
import { nombreDeLaParte, partesDelLote, planesDeLaParte } from "@/lib/print-batches/zip-del-lote";
import { NOMBRE_RESUMEN, organizarPorTamano } from "@/lib/orders/print-export/organizar-por-tamano";
import { filasDelZip, type FilaConClave } from "@/lib/orders/print-export/verificacion";
import { verificarEnR2 } from "@/lib/orders/print-export/verificacion-servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    const batchId = Number((await ctx.params).id);
    if (!Number.isInteger(batchId) || batchId <= 0) return NextResponse.json({ error: "Lote no encontrado." }, { status: 404 });

    const lote = await loteDelFotografo(user.id, batchId);
    const total = partesDelLote(lote.entries.flatMap((e) => (e.albumOrderId != null ? [e.albumOrderId] : []))).length;

    const filas: FilaConClave[] = [];
    const omitidos: string[] = [];
    const zips: string[] = [];
    for (let parte = 1; parte <= total; parte++) {
      const zip = nombreDeLaParte(lote.nombre, parte, total);
      const p = await planesDeLaParte(batchId, parte);
      omitidos.push(...p.omitidos);
      if (p.planes.length === 0) continue;
      zips.push(zip);
      // Igual que `responderZipDeLaParte`: por tamaño y acabado, sin carpeta por cliente.
      filas.push(...filasDelZip(organizarPorTamano(p.planes, { separarClientes: false }).plans, zip, filas.length + 1));
    }

    return NextResponse.json({
      nombre: lote.nombre,
      zips,
      archivos: await verificarEnR2(filas),
      omitidos,
      control: [NOMBRE_RESUMEN, "Control/REMITO.pdf", "Control/<pedido>/MANIFEST.txt y RESUMEN_PEDIDO.pdf (uno por pedido)"],
    });
  } catch (err: unknown) {
    if (err instanceof LoteError) return NextResponse.json({ error: err.message }, { status: 404 });
    console.error("VERIFICAR LOTE IMPRESION ERROR >>>", err);
    return NextResponse.json({ error: "No se pudo armar la verificación del lote. Probá de nuevo." }, { status: 500 });
  }
}
