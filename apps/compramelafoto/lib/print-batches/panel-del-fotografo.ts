import "server-only";
import { prisma } from "@/lib/prisma";
import { secretoDeEntrega } from "@/lib/school-fulfillment/codigo-de-canje";
import { codigoDeEntregaDePedido } from "./codigos";
import { leerResumen } from "./puerta-del-lab";
import { listarParaImprimir } from "./servicio";
import { DIAS_DE_ENTREGADOS, textoDeImpresion, type DatosDelPanel, type EntradaDelPanel, type LoteDelPanel } from "./panel";
import type { EstadoLote } from "./reglas";

/**
 * Datos del panel «Impresiones» del fotógrafo: para imprimir, sus lotes (sin anulados; los cerrados,
 * sólo los últimos 30 días) y sus laboratorios activos. Tres consultas en paralelo más las de
 * `listarParaImprimir`; nada por pedido. Nunca devuelve el `tokenHash` ni el token del lote.
 */

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export async function datosDelPanel(photographerId: number, ahora = new Date()): Promise<DatosDelPanel> {
  const desde = new Date(ahora.getTime() - DIAS_DE_ENTREGADOS * 24 * 60 * 60 * 1000);
  const secreto = secretoDeEntrega();
  const [paraImprimir, lotes, laboratorios] = await Promise.all([
    listarParaImprimir(photographerId),
    prisma.printBatch.findMany({
      where: {
        photographerId,
        tipo: "COMUNES",
        OR: [{ estado: { notIn: ["ANULADO", "CERRADO"] } }, { estado: "CERRADO", cerradoAt: { gte: desde } }],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, nombre: true, estado: true, entregaPreferida: true, labContactId: true, mensajeAlLab: true,
        fechaPrometida: true, createdAt: true, enviadoAt: true, labAbrioAt: true, labDescargoAt: true,
        listoAt: true, recibidoAt: true, cerradoAt: true, pagadoAlLabAt: true,
        labContact: { select: { nombre: true } },
        entries: {
          where: { quitadoAt: null },
          orderBy: { id: "asc" },
          select: {
            id: true, albumOrderId: true, printOrderId: true, retiraCliente: true, pickupLabContactId: true,
            resumen: true, entregadoAt: true, printOrder: { select: { status: true } },
          },
        },
      },
    }),
    prisma.photographerLabContact.findMany({
      where: { photographerId, activo: true },
      orderBy: [{ esPredeterminado: "desc" }, { nombre: "asc" }],
      select: { id: true, nombre: true, esPredeterminado: true, puntoDeRetiro: true },
    }),
  ]);

  return {
    paraImprimir: paraImprimir.map((p) => ({
      albumOrderId: p.albumOrderId, cliente: p.cliente, album: p.album, copias: p.copias, totalCopias: p.totalCopias,
      retiraCliente: p.retiraCliente, pickupLabContactId: p.pickupLabContactId, pagadoAt: p.pagadoAt.toISOString(), motivo: p.motivo,
    })),
    lotes: lotes.map((b): LoteDelPanel => ({
      id: b.id, nombre: b.nombre, estado: b.estado as EstadoLote, entregaPreferida: b.entregaPreferida,
      labContactId: b.labContactId, laboratorio: b.labContact?.nombre ?? null, mensajeAlLab: b.mensajeAlLab,
      fechaPrometida: iso(b.fechaPrometida), createdAt: b.createdAt.toISOString(), enviadoAt: iso(b.enviadoAt),
      labAbrioAt: iso(b.labAbrioAt), labDescargoAt: iso(b.labDescargoAt), listoAt: iso(b.listoAt),
      recibidoAt: iso(b.recibidoAt), cerradoAt: iso(b.cerradoAt), pagadoAlLabAt: iso(b.pagadoAlLabAt),
      entradas: b.entries.map((e): EntradaDelPanel => {
        const r = leerResumen(e.resumen);
        // `leerResumen` esconde un correo usado como nombre (es para el laboratorio); el fotógrafo lo ve.
        const crudo = (e.resumen as { cliente?: unknown } | null)?.cliente;
        const cliente = typeof crudo === "string" && crudo.trim() ? crudo.trim() : r.cliente;
        const conQr = b.estado !== "ARMADO" && e.printOrderId != null && e.entregadoAt == null && secreto != null;
        return {
          id: e.id, albumOrderId: e.albumOrderId, cliente, album: r.album, copias: r.copias, totalCopias: r.totalCopias,
          retiraCliente: e.retiraCliente, pickupLabContactId: e.pickupLabContactId, estadoPedido: e.printOrder?.status ?? null,
          entregadoAt: iso(e.entregadoAt), codigoQr: conQr ? codigoDeEntregaDePedido(e.printOrderId!, secreto!) : null,
        };
      }),
    })),
    laboratorios,
  };
}

/** Estado de impresión de un pedido de álbum del fotógrafo («Enviado al laboratorio · Lote 3»), o null. */
export async function impresionDelPedido(photographerId: number, albumOrderId: number): Promise<{ texto: string; loteId: number } | null> {
  const e = await prisma.printBatchEntry.findFirst({
    where: { albumOrderId, quitadoAt: null, batch: { photographerId, estado: { not: "ANULADO" } } },
    orderBy: { id: "desc" },
    select: { entregadoAt: true, printOrder: { select: { status: true } }, batch: { select: { id: true, nombre: true, estado: true } } },
  });
  if (!e) return null;
  return {
    loteId: e.batch.id,
    texto: textoDeImpresion({
      loteEstado: e.batch.estado as EstadoLote, loteNombre: e.batch.nombre,
      estadoPedido: e.printOrder?.status ?? null, entregado: e.entregadoAt != null,
    }),
  };
}
