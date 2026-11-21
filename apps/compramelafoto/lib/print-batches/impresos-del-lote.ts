import "server-only";
import { prisma } from "@/lib/prisma";
import { secretoDeEntrega } from "@/lib/school-fulfillment/codigo-de-canje";
import { baseAppUrl } from "@/lib/school-fulfillment/entrega-url";
import type { PrintExportPlan } from "@/lib/orders/print-export/stream-print-export-zip";
import { codigoDeEntregaDePedido } from "./codigos";
import { pdfDeSobres, pdfEtiquetaDeLote, pdfRemito, textoDeContenido, type FilaDeRemito, type SobreDePedido } from "./impresos";
import { aNombreDe, leerResumen, nombreDelFotografo } from "./puerta-del-lab";

/**
 * Arma los PDFs del lote (sobres, etiqueta, remito) con los datos de la base. Quién puede pedirlos
 * lo decide la ruta. Sólo los pedidos vivos (sin los quitados); nunca correo ni teléfono del cliente.
 */

export const FALTA_SECRETO = "Falta configurar el secreto de entrega.";
const SIN_LABORATORIO = "Sin laboratorio";

async function cargar(batchId: number) {
  const b = await prisma.printBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true, nombre: true, labContactId: true,
      photographer: { select: { name: true, companyName: true } },
      entries: {
        where: { quitadoAt: null }, orderBy: { id: "asc" },
        select: { albumOrderId: true, printOrderId: true, retiraCliente: true, pickupLabContactId: true, resumen: true },
      },
    },
  });
  if (!b) return null;
  const ids = [b.labContactId, ...b.entries.map((e) => e.pickupLabContactId)].filter((x): x is number => x != null);
  const contactos = ids.length
    ? await prisma.photographerLabContact.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } })
    : [];
  const nombreDe = new Map(contactos.map((c) => [c.id, c.nombre.trim()]));
  const fotografo = nombreDelFotografo(b.photographer);
  const laboratorio = (b.labContactId != null && nombreDe.get(b.labContactId)) || SIN_LABORATORIO;
  const filas = b.entries.map((e) => {
    const r = leerResumen(e.resumen);
    return { e, r, pedido: r.pedido ?? e.albumOrderId ?? 0, labDelPedido: e.pickupLabContactId != null ? nombreDe.get(e.pickupLabContactId) : undefined };
  });
  return { b, fotografo, laboratorio, filas };
}

export async function sobresDelLote(batchId: number): Promise<Uint8Array | null> {
  const secreto = secretoDeEntrega();
  if (!secreto) throw new Error(FALTA_SECRETO);
  const d = await cargar(batchId);
  if (!d) return null;
  const base = baseAppUrl();
  const sobres: SobreDePedido[] = d.filas.map(({ e, r, pedido, labDelPedido }) => ({
    fotografo: d.fotografo, cliente: r.cliente, album: r.album, pedido, contenido: textoDeContenido(r.copias), lote: d.b.nombre,
    retiraCliente: e.retiraCliente, laboratorio: e.retiraCliente ? labDelPedido || d.laboratorio : d.laboratorio,
    qrUrl: e.printOrderId != null
      ? `${base}/pedido/entrega/${codigoDeEntregaDePedido(e.printOrderId, secreto)}`
      : `${base}/fotografo/impresiones?lote=${d.b.id}`,
  }));
  return pdfDeSobres(sobres);
}

export async function etiquetaDelLote(batchId: number): Promise<Uint8Array | null> {
  const d = await cargar(batchId);
  if (!d) return null;
  return pdfEtiquetaDeLote({
    lote: d.b.nombre, fotografo: d.fotografo, laboratorio: d.laboratorio, pedidos: d.filas.length,
    copias: d.filas.reduce((s, f) => s + f.r.totalCopias, 0),
    qrUrl: `${baseAppUrl()}/fotografo/impresiones?lote=${d.b.id}`,
  });
}

function filaDeRemito(f: NonNullable<Awaited<ReturnType<typeof cargar>>>["filas"][number], fotografo: string): FilaDeRemito {
  return { pedido: f.pedido, nombre: aNombreDe(fotografo, f.r.cliente), contenido: textoDeContenido(f.r.copias), retiraCliente: f.e.retiraCliente };
}

/** Remito de todo el lote vivo, o (con `planes`) sólo de los pedidos de una parte que entraron al ZIP. */
export async function remitoDelLote(
  batchId: number,
  parte?: { planes: PrintExportPlan[]; omitidos: string[] },
): Promise<Uint8Array | null> {
  const d = await cargar(batchId);
  if (!d) return null;
  const entraron = parte ? new Set(parte.planes.map((p) => p.codigo)) : null;
  const filas = d.filas
    .filter((f) => !entraron || (f.e.albumOrderId != null && entraron.has(String(f.e.albumOrderId))))
    .map((f) => filaDeRemito(f, d.fotografo));
  return pdfRemito({ lote: d.b.nombre, fotografo: d.fotografo, laboratorio: d.laboratorio, filas, noIncluidos: parte?.omitidos });
}
