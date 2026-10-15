/**
 * GET /api/fotografo/pedidos/export-print-lote?albumes=3888,3882&impresion=652
 *
 * Varios pedidos en un solo ZIP, cada uno en su carpeta con la misma organización que la
 * descarga de a uno (Producto/Acabado/Tamaño + MANIFEST + resumen). Reemplaza a abrir una
 * pestaña por pedido, que el navegador bloqueaba como ventanas emergentes.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { loadAlbumOrderPrintPlan } from "@/lib/orders/print-export/album-order-print-plan";
import { loadPrintOrderPrintPlan } from "@/lib/orders/print-export/print-order-print-plan";
import {
  streamPrintExportZip,
  type PrintExportPlan,
} from "@/lib/orders/print-export/stream-print-export-zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Tope por descarga. La función dura lo que tarda el ZIP en llegar a la computadora de la
 * fotógrafa (máximo cinco minutos): ~20 MB por pedido, 15 pedidos ≈ 300 MB, que con una
 * conexión común entra con margen. Más pedidos se bajan en otra tanda.
 */
const MAX_PEDIDOS = 15;

function ids(raw: string | null): number[] {
  return Array.from(
    new Set(
      String(raw ?? "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0)
    )
  );
}

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }
    const albumes = ids(req.nextUrl.searchParams.get("albumes"));
    const impresion = ids(req.nextUrl.searchParams.get("impresion"));
    const total = albumes.length + impresion.length;
    if (total === 0) return NextResponse.json({ error: "Elegí al menos un pedido." }, { status: 400 });
    if (total > MAX_PEDIDOS) {
      return NextResponse.json(
        { error: `Se pueden descargar hasta ${MAX_PEDIDOS} pedidos juntos. Elegí menos y repetí.` },
        { status: 400 }
      );
    }

    const plans: PrintExportPlan[] = [];
    const omitidos: string[] = [];
    for (const id of albumes) {
      const r = await loadAlbumOrderPrintPlan(id, user);
      if (r.ok) plans.push(r.plan);
      else omitidos.push(`Pedido ${id}: ${r.error}`);
    }
    for (const id of impresion) {
      const r = await loadPrintOrderPrintPlan(id, user);
      if (r.ok) plans.push(r.plan);
      else omitidos.push(`Pedido de impresión ${id}: ${r.error}`);
    }
    if (plans.length === 0) {
      return NextResponse.json(
        { error: "Ninguno de los pedidos elegidos tiene impresiones para descargar.", detalle: omitidos },
        { status: 400 }
      );
    }

    const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
    const extras = omitidos.length
      ? [{ name: "PEDIDOS_NO_INCLUIDOS.txt", content: ["Estos pedidos no se incluyeron:", "", ...omitidos].join("\n") }]
      : [];
    return streamPrintExportZip(plans, `Impresiones ${fecha} - ${plans.length} pedidos`, extras);
  } catch (err: unknown) {
    console.error("EXPORT PRINT LOTE ERROR >>>", err);
    return NextResponse.json(
      { error: "Error exportando los pedidos", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
