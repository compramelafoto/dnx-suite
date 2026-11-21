import "server-only";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cargarPlanDePedidoDeAlbum } from "@/lib/orders/print-export/album-order-print-plan";
import { CARPETA_CONTROL, organizarPorTamano } from "@/lib/orders/print-export/organizar-por-tamano";
import { streamPrintExportZip, type PrintExportPlan } from "@/lib/orders/print-export/stream-print-export-zip";
import { partesDelLote } from "./partes-del-lote";

/**
 * ZIP de un lote de impresión, de a 15 pedidos por parte (ver `partes-del-lote`). Va ordenado
 * para el laboratorio: una carpeta por tamaño y acabado, sin carpeta por cliente (el número de
 * pedido encabeza cada archivo). Sólo las copias sueltas: un librito o carpeta escolar del mismo
 * pedido sigue su propia línea y no entra.
 *
 * Quién puede bajarlo lo decide la ruta (dueño del lote o laboratorio con su enlace).
 */

export { PEDIDOS_POR_PARTE, nombreDeLaParte, partesDelLote } from "./partes-del-lote";

const PARTE_INEXISTENTE = "Esa parte del lote no existe.";
const LOTE_INEXISTENTE = "Lote no encontrado.";

class ZipDelLoteError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Los pedidos vivos del lote (sin los quitados), en el orden en que entraron. Un lote anulado no existe. */
async function pedidosDelLote(batchId: number): Promise<number[]> {
  const lote = await prisma.printBatch.findUnique({
    where: { id: batchId },
    select: {
      estado: true,
      entries: { where: { quitadoAt: null, albumOrderId: { not: null } }, orderBy: { id: "asc" }, select: { albumOrderId: true } },
    },
  });
  if (!lote || lote.estado === "ANULADO") throw new ZipDelLoteError(LOTE_INEXISTENTE, 404);
  return lote.entries.map((e) => e.albumOrderId!);
}

async function cargarLaParte(batchId: number, parte: number): Promise<{ planes: PrintExportPlan[]; omitidos: string[] }> {
  const partes = partesDelLote(await pedidosDelLote(batchId));
  if (!Number.isInteger(parte) || parte < 1 || parte > partes.length) throw new ZipDelLoteError(PARTE_INEXISTENTE, 404);
  const planes: PrintExportPlan[] = [];
  const omitidos: string[] = [];
  for (const id of partes[parte - 1]!) {
    const r = await cargarPlanDePedidoDeAlbum(id, { incluirDisenos: false });
    if (r.ok) planes.push(r.plan);
    else omitidos.push(`Pedido ${id}: ${r.error}`);
  }
  return { planes, omitidos };
}

/** Los planes de impresión de la parte `parte` (empieza en 1), sólo con las copias sueltas. */
export async function planesDeLaParte(batchId: number, parte: number): Promise<PrintExportPlan[]> {
  return (await cargarLaParte(batchId, parte)).planes;
}

/**
 * La descarga de una parte. `extras` son archivos de control (p. ej. el remito en PDF) que van
 * en la carpeta `Control/`. Lote inexistente o anulado, o parte fuera de rango: 404.
 */
export async function responderZipDeLaParte(
  batchId: number,
  parte: number,
  nombreArchivo: string,
  extras: Array<{ name: string; content: Uint8Array }> = [],
): Promise<Response> {
  try {
    const { planes, omitidos } = await cargarLaParte(batchId, parte);
    if (planes.length === 0) {
      return NextResponse.json(
        { error: "Ninguno de los pedidos de esta parte tiene impresiones para descargar.", detalle: omitidos },
        { status: 400 },
      );
    }
    const porTamano = organizarPorTamano(planes, { separarClientes: false });
    const noIncluidos = omitidos.length
      ? [{ name: "PEDIDOS_NO_INCLUIDOS.txt", content: ["Estos pedidos no se incluyeron:", "", ...omitidos].join("\n") }]
      : [];
    const control = extras.map((e) => ({ name: `${CARPETA_CONTROL}/${e.name}`, content: e.content }));
    // `streamPrintExportZip` ya le pone el «.zip».
    const nombre = nombreArchivo.replace(/\.zip$/i, "");
    return streamPrintExportZip(porTamano.plans, nombre, [porTamano.resumen, ...noIncluidos, ...control]);
  } catch (err) {
    if (err instanceof ZipDelLoteError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
