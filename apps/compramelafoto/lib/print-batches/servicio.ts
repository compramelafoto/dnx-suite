import "server-only";
import { prisma, type Prisma, type PrintOrderStatus } from "@/lib/prisma";
import { createAlbumOrderPrintOrderMirror } from "@/lib/orders/create-album-order-print-order-mirror";
import { copiasFueraDelDiseno } from "@/lib/orders/print-export/copias-fuera-del-diseno";
import { loadOrderDesigns } from "@/lib/orders/print-export/order-designs";
import { esPedidoDemo } from "@/lib/canje-externo/pack-de-prueba";
import { nombreDelProximoLote } from "@/lib/design-v2/produccion-reglas";
import { fileExistsInR2, urlToR2Key } from "@/lib/r2-client";
import { queueEmail } from "@/lib/email-queue";
import { avisaAlCliente, ESPEJO_ENTREGADO, estadoDelPedidoEnElTramo, loteCerrado, motivoParaNoEntrar, puedeMover, vaPorPedidosEscolares, type EstadoLote } from "./reglas";
import { contactoDeRetiro, direccionDelContacto, retiraElCliente } from "./puntos-de-retiro";
import { contactoDeRetiroDelPedido, contactosActivosDelFotografo } from "./retiro-del-pedido";
import { nombreDelFotografo } from "./puerta-del-lab";
import { DIAS_PARA_IMPRIMIR, MAX_PARA_IMPRIMIR } from "./panel";
import { nuevoTokenDeLote } from "./codigos";
import { correoAlLaboratorio, correoListoRetiraEnLaboratorio, correoListoRetiraFotografo, resumirCopias, type CopiaResumen } from "./correos";

/**
 * Lotes de impresión de pedidos comunes (CLF): qué se puede imprimir, armar, mandar al laboratorio,
 * mover de estado, sacar/reimprimir y entregar. El estado de cada pedido vive en su `PrintOrder` espejo
 * (sin `labId`, sin pasar por /api/print-orders) y el lote en `PrintBatch`.
 */

export class LoteError extends Error {}
/** Lote o pedido del lote inexistente o ajeno (las rutas del panel responden 404). Sigue siendo un `LoteError`. */
export class LoteNoEncontrado extends LoteError {}

export type PedidoParaImprimir = {
  albumOrderId: number; printOrderId: number | null; cliente: string; album: string;
  copias: Array<{ medida: string; acabado: string; cantidad: number }>; totalCopias: number;
  retiraCliente: boolean; pickupLabContactId: number | null; pagadoAt: Date; motivo: string | null;
};
type Candidato = PedidoParaImprimir & {
  buyerEmail: string; buyerPhone: string | null; loteVivo: string | null; espejoResuelto: boolean;
  itemsImpresos: Array<{ fileKey: string; size: string; acabado: string; quantity: number; unitPrice: number; subtotal: number }>;
  r2Keys: string[];
};

type MarcaDeTiempo = "enProduccionAt" | "listoAt" | "despachadoAt" | "recibidoAt" | "cerradoAt";
const MARCA_DE_TIEMPO: Partial<Record<EstadoLote, MarcaDeTiempo>> = {
  EN_PRODUCCION: "enProduccionAt", LISTO: "listoAt", DESPACHADO: "despachadoAt", RECIBIDO: "recibidoAt", CERRADO: "cerradoAt",
};
/** Pedidos espejo que ya se resolvieron por otro lado: no vuelven a «Para imprimir». */
const ESPEJO_RESUELTO = ["DELIVERED", "CANCELED", "RETIRED", "SHIPPED"];
const ERROR_CORREO_LAB = "No se pudo mandar el correo al laboratorio. Probá de nuevo.";

function appUrl(): string {
  return (process.env.APP_URL || "https://www.compramelafoto.com").replace(/\/+$/, "");
}
const tagDe = (albumOrderId: number) => `ALBUM_ORDER:${albumOrderId}`;
const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Los pedidos pagados con impresiones del fotógrafo, con su motivo para no entrar. Sin `ids` es el
 * listado de «Para imprimir»: los creados en los últimos `DIAS_PARA_IMPRIMIR` días que no están en
 * un lote vivo, del más nuevo al más viejo, hasta `MAX_PARA_IMPRIMIR` (los que ya están en un lote
 * se ven en su lote, sin importar la fecha). Con `ids` (armar o enviar) no hay ventana ni tope.
 */
async function cargarCandidatos(photographerId: number, ids?: number[]): Promise<Candidato[]> {
  const orders = await prisma.order.findMany({
    where: {
      ...(ids
        ? { id: { in: ids } }
        : { printBatchEntries: { none: { quitadoAt: null } }, createdAt: { gte: new Date(Date.now() - DIAS_PARA_IMPRIMIR * DIA_MS) } }),
      status: "PAID",
      album: { userId: photographerId, isTest: false },
      items: { some: { productType: { in: ["PRINT", "FRAME"] } } },
    },
    orderBy: { createdAt: ids ? "asc" : "desc" },
    ...(ids ? {} : { take: MAX_PARA_IMPRIMIR }),
    select: {
      id: true, status: true, isTest: true, origin: true, createdAt: true, buyerEmail: true, buyerName: true,
      buyerPhone: true, redeemsOrderId: true, pickupLabContactId: true,
      buyerUser: { select: { name: true } },
      album: { select: { title: true, pickupBy: true, deletedAt: true } },
      items: {
        where: { productType: { in: ["PRINT", "FRAME"] } },
        select: { photoId: true, quantity: true, size: true, finish: true, priceCents: true, subtotalCents: true,
          photo: { select: { originalKey: true, isRemoved: true } } },
      },
      printBatchEntries: { where: { quitadoAt: null }, select: { batch: { select: { nombre: true } } } },
    },
  });
  const vivos = orders.filter((o) => !esPedidoDemo(o));
  if (vivos.length === 0) return [];
  const oids = vivos.map((o) => o.id);
  const [espejos, conDiseno, escolares, contactos] = await Promise.all([
    prisma.printOrder.findMany({ where: { tags: { hasSome: oids.map(tagDe) } }, select: { id: true, tags: true, status: true } }),
    prisma.designProject.findMany({ where: { albumOrderId: { in: oids }, albumPackDraftId: null }, select: { albumOrderId: true }, distinct: ["albumOrderId"] }),
    prisma.schoolCopiesPrintJob.findMany({ where: { orderId: { in: oids } }, select: { orderId: true } }),
    contactosActivosDelFotografo(photographerId),
  ]);
  const espejoDe = new Map<number, { id: number; status: string }>();
  for (const e of espejos) for (const t of e.tags) if (t.startsWith("ALBUM_ORDER:")) espejoDe.set(Number(t.slice(12)), e);
  const tienenDiseno = new Set(conDiseno.map((d) => d.albumOrderId));
  const enLineaEscolar = new Set(escolares.map((e) => e.orderId));

  const esCanje = (o: (typeof vivos)[number]) =>
    vaPorPedidosEscolares({ origin: o.origin, redeemsOrderId: o.redeemsOrderId, enLineaEscolar: enLineaEscolar.has(o.id) });
  // En el listado no van los canjes (viajan por Pedidos escolares) ni los espejos ya resueltos por otro lado.
  const aMirar = ids ? vivos : vivos.filter((o) => {
    const espejo = espejoDe.get(o.id);
    return !esCanje(o) && !(espejo && ESPEJO_RESUELTO.includes(espejo.status));
  });
  const disenos = new Map(await Promise.all(
    aMirar.filter((o) => tienenDiseno.has(o.id) && !esCanje(o))
      .map(async (o) => [o.id, (await loadOrderDesigns(o.id)).flatMap((d) => d.photoIds)] as const),
  ));

  const salida: Candidato[] = [];
  for (const o of aMirar) {
    const espejo = espejoDe.get(o.id) ?? null;
    const fotosDeDisenos = disenos.get(o.id) ?? [];
    const sueltas = copiasFueraDelDiseno(o.items, fotosDeDisenos);
    const copias = resumirCopias(sueltas.map((it): CopiaResumen => ({
      medida: it.size?.trim() || "Sin medida", acabado: it.finish?.trim() || "", cantidad: Number(it.quantity || 0),
    })));
    const totalCopias = copias.reduce((s, c) => s + c.cantidad, 0);
    const retiraCliente = retiraElCliente(o.album.pickupBy);
    const sinArchivos = o.album.deletedAt != null || sueltas.some((it) => it.photo.isRemoved || !it.photo.originalKey);
    const motivo =
      motivoParaNoEntrar({
        orderStatus: o.status, esDemo: false, esCanjeVoucher: esCanje(o),
        copiasSueltas: totalCopias, enLoteVivo: o.printBatchEntries.length > 0,
      }) ?? (sinArchivos ? "El álbum venció: las fotos ya no están." : null);
    salida.push({
      albumOrderId: o.id, printOrderId: espejo?.id ?? null,
      cliente: o.buyerName?.trim() || o.buyerUser?.name?.trim() || o.buyerEmail,
      album: o.album.title, copias, totalCopias, retiraCliente,
      // Elegido desactivado o que dejó de ser punto de retiro: el predeterminado activo, si hay.
      pickupLabContactId: retiraCliente ? contactoDeRetiro(o.pickupLabContactId, contactos)?.id ?? null : null,
      pagadoAt: o.createdAt, motivo,
      buyerEmail: o.buyerEmail, buyerPhone: o.buyerPhone, espejoResuelto: !!espejo && ESPEJO_RESUELTO.includes(espejo.status), loteVivo: o.printBatchEntries[0]?.batch.nombre ?? null,
      itemsImpresos: o.items.map((it) => ({
        fileKey: it.photo.originalKey, size: String(it.size || "").trim(), acabado: String(it.finish || "BRILLO").trim().toUpperCase() || "BRILLO",
        quantity: it.quantity, unitPrice: it.priceCents, subtotal: it.subtotalCents,
      })),
      r2Keys: sueltas.map((it) => urlToR2Key(it.photo.originalKey)),
    });
  }
  return salida;
}

export async function listarParaImprimir(photographerId: number): Promise<PedidoParaImprimir[]> {
  const candidatos = await cargarCandidatos(photographerId);
  return candidatos.map(({ buyerEmail: _e, buyerPhone: _p, loteVivo: _l, espejoResuelto: _r, itemsImpresos: _i, r2Keys: _k, ...p }) => p);
}

/** El primer pedido al que le falta algún original en R2, o null. */
async function pedidoSinArchivos(pedidos: Array<{ albumOrderId: number; r2Keys: string[] }>): Promise<number | null> {
  for (const p of pedidos) {
    const existen = await Promise.all(p.r2Keys.map((k) => fileExistsInR2(k)));
    if (existen.some((e) => !e)) return p.albumOrderId;
  }
  return null;
}
const errorSinArchivos = (id: number) => new LoteError(`Al pedido #${id} le faltan fotos: el álbum venció o se borraron.`);

async function nombreDelLoteVivo(albumOrderIds: number[]): Promise<string | null> {
  const e = await prisma.printBatchEntry.findFirst({
    where: { albumOrderId: { in: albumOrderIds }, quitadoAt: null }, select: { batch: { select: { nombre: true } } },
  });
  return e?.batch.nombre ?? null;
}

export async function armarLote(photographerId: number, albumOrderIds: number[], labContactId: number | null): Promise<{ batchId: number; nombre: string }> {
  const ids = [...new Set(albumOrderIds)];
  if (ids.length === 0) throw new LoteError("Elegí al menos un pedido.");
  if (labContactId != null) {
    const c = await prisma.photographerLabContact.findFirst({ where: { id: labContactId, photographerId, activo: true }, select: { id: true } });
    if (!c) throw new LoteError("Ese laboratorio no está en tus laboratorios.");
  }
  const candidatos = await cargarCandidatos(photographerId, ids);
  const porId = new Map(candidatos.map((c) => [c.albumOrderId, c]));
  let labDelLote = labContactId;
  for (const id of ids) {
    const p = porId.get(id);
    if (!p) throw new LoteError(`El pedido #${id} no se puede imprimir: no es tuyo o no está pagado.`);
    if (p.loteVivo) throw new LoteError(`Ese pedido ya está en el ${p.loteVivo}.`);
    if (p.espejoResuelto) throw new LoteError("Ese pedido ya fue entregado o cancelado.");
    if (p.motivo) throw new LoteError(`Pedido #${id}: ${p.motivo}`);
    if (p.pickupLabContactId != null) {
      if (labDelLote == null) labDelLote = p.pickupLabContactId;
      else if (labDelLote !== p.pickupLabContactId) throw new LoteError(`El pedido #${id} se retira en otro laboratorio: armá un lote aparte.`);
    }
  }
  const faltan = await pedidoSinArchivos(candidatos);
  if (faltan != null) throw errorSinArchivos(faltan);

  const [lotes, disenos, copias] = await Promise.all([
    prisma.printBatch.findMany({ where: { photographerId }, select: { nombre: true } }),
    prisma.designProject.findMany({ where: { photographerUserId: photographerId, printBatchName: { not: null } }, distinct: ["printBatchName"], select: { printBatchName: true } }),
    prisma.schoolCopiesPrintJob.findMany({ where: { photographerUserId: photographerId, printBatchName: { not: null } }, distinct: ["printBatchName"], select: { printBatchName: true } }),
  ]);
  const nombre = nombreDelProximoLote(
    [...lotes.map((l) => l.nombre), ...disenos.map((d) => d.printBatchName!), ...copias.map((c) => c.printBatchName!)],
    new Date(),
  );
  try {
    const batchId = await prisma.$transaction(async (tx) => {
      const entries: Prisma.PrintBatchEntryCreateWithoutBatchInput[] = [];
      for (const id of ids) {
        const p = porId.get(id)!;
        const espejo = p.printOrderId != null ? { printOrderId: p.printOrderId } : await createAlbumOrderPrintOrderMirror(tx, {
          albumOrderId: id, photographerId, customerName: p.cliente, customerEmail: p.buyerEmail,
          customerPhone: p.buyerPhone, printItems: p.itemsImpresos,
        });
        if (!espejo) throw new LoteError(`Al pedido #${id} no se le pudo armar la impresión.`);
        entries.push({
          albumOrder: { connect: { id } },
          printOrder: { connect: { id: espejo.printOrderId } },
          retiraCliente: p.retiraCliente, pickupLabContactId: p.pickupLabContactId,
          resumen: { cliente: p.cliente, pedido: id, album: p.album, copias: p.copias, totalCopias: p.totalCopias },
        });
      }
      const b = await tx.printBatch.create({
        data: { photographerId, labContactId: labDelLote, nombre, tipo: "COMUNES", estado: "ARMADO", entries: { create: entries } },
        select: { id: true },
      });
      return b.id;
    });
    return { batchId, nombre };
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") {
      throw new LoteError(`Ese pedido ya está en el ${(await nombreDelLoteVivo(ids)) ?? "otro lote"}.`);
    }
    throw e;
  }
}

/** El lote del fotógrafo con sus pedidos vivos; si no es suyo o no existe, `LoteError`. */
export async function loteDelFotografo(photographerId: number, batchId: number) {
  const b = await prisma.printBatch.findFirst({
    where: { id: batchId, photographerId },
    include: { entries: { where: { quitadoAt: null } }, photographer: { select: { name: true, companyName: true, email: true } } },
  });
  if (!b) throw new LoteNoEncontrado("Lote no encontrado.");
  return b;
}

export async function deshacerLote(photographerId: number, batchId: number): Promise<void> {
  const b = await loteDelFotografo(photographerId, batchId);
  if (!puedeMover(b.estado, "ANULADO", "FOTOGRAFO", b.entregaPreferida)) throw new LoteError("Sólo se puede deshacer un lote que todavía no salió.");
  const ahora = new Date();
  await prisma.$transaction(async (tx) => {
    const r = await tx.printBatch.updateMany({ where: { id: batchId, estado: "ARMADO" }, data: { estado: "ANULADO" } });
    if (r.count === 0) throw new LoteError("El lote cambió mientras tanto. Recargá la página.");
    await tx.printBatchEntry.updateMany({ where: { batchId, quitadoAt: null }, data: { quitadoAt: ahora } });
  });
}

/** Cambia el estado del espejo si sigue en `anterior` y deja el historial. Devuelve el id del historial o null. */
async function cambiarEstadoDelPedido(printOrderId: number, anterior: PrintOrderStatus, nuevo: PrintOrderStatus, userId: number | null, notes: string): Promise<number | null> {
  return prisma.$transaction(async (tx) => {
    const r = await tx.printOrder.updateMany({
      where: { id: printOrderId, status: anterior },
      data: { status: nuevo, statusUpdatedAt: new Date() },
    });
    if (r.count === 0) return null;
    const h = await tx.printOrderStatusHistory.create({
      data: { printOrderId, status: nuevo, changedByUserId: userId, notes }, select: { id: true },
    });
    return h.id;
  });
}

/** Lleva los pedidos vivos del lote al estado que corresponde a `hacia` (los que ya están, quedan igual). */
async function aplicarAPedidos(batch: { nombre: string; entries: Array<{ printOrderId: number | null; retiraCliente: boolean; entregadoAt: Date | null }> }, desde: EstadoLote, hacia: EstadoLote, userId: number | null) {
  for (const e of batch.entries) {
    const nuevo = estadoDelPedidoEnElTramo(desde, hacia, e.retiraCliente);
    if (!e.printOrderId || e.entregadoAt || !nuevo) continue;
    const po = await prisma.printOrder.findUnique({ where: { id: e.printOrderId }, select: { status: true } });
    if (!po || po.status === nuevo || ESPEJO_ENTREGADO.includes(po.status) || po.status === "CANCELED") continue;
    if (nuevo === "READY_TO_PICKUP") {
      await marcarListoParaRetirar(e.printOrderId, { userId: userId ?? undefined, nota: `Lote ${batch.nombre}` });
      continue;
    }
    await cambiarEstadoDelPedido(e.printOrderId, po.status, nuevo, userId, `Lote ${batch.nombre}`);
  }
}

export async function enviarLote(photographerId: number, batchId: number, opts: { labContactId: number; mensaje?: string; entregaPreferida: "RETIRA_FOTOGRAFO" | "ENVIA_LAB"; fechaPrometida?: Date }): Promise<void> {
  const b = await loteDelFotografo(photographerId, batchId);
  if (b.estado !== "ARMADO") throw new LoteError("Este lote ya fue enviado.");
  if (b.entries.length === 0) throw new LoteError("El lote no tiene pedidos.");
  const lab = await prisma.photographerLabContact.findFirst({ where: { id: opts.labContactId, photographerId, activo: true } });
  if (!lab) throw new LoteError("Ese laboratorio no está en tus laboratorios.");
  // Si el punto de retiro de un pedido se desactivó desde que se armó el lote, pasa al predeterminado
  // (o a «donde se imprime» si no hay); el lote se manda con eso.
  const contactos = await contactosActivosDelFotografo(photographerId);
  const retiroVigente = new Map(b.entries.map((e) => [
    e.id,
    e.retiraCliente && e.pickupLabContactId != null ? contactoDeRetiro(e.pickupLabContactId, contactos, lab.id)?.id ?? null : e.pickupLabContactId,
  ]));
  const otro = b.entries.find((e) => { const v = retiroVigente.get(e.id); return v != null && v !== lab.id; });
  if (otro) throw new LoteError(`El pedido #${otro.albumOrderId} se retira en otro laboratorio: mandá el lote a ese.`);

  const pedidos = b.entries.filter((e) => e.albumOrderId != null).map((e) => e.albumOrderId!);
  const candidatos = await cargarCandidatos(photographerId, pedidos);
  const faltaPedido = pedidos.find((id) => !candidatos.some((c) => c.albumOrderId === id));
  if (faltaPedido != null) throw new LoteError(`El pedido #${faltaPedido} ya no se puede imprimir.`);
  const faltan = await pedidoSinArchivos(candidatos);
  if (faltan != null) throw errorSinArchivos(faltan);

  const { token, hash } = nuevoTokenDeLote();
  const copias = candidatos.flatMap((c) => c.copias);
  const correo = correoAlLaboratorio({
    nombreLote: b.nombre, fotografo: nombreDelFotografo(b.photographer), pedidos: pedidos.length, copias,
    mensaje: opts.mensaje, enlace: `${appUrl()}/lab/lote/${token}`, labTieneCuenta: lab.labId != null,
    labEmail: lab.email, baseUrl: appUrl(),
  });
  // Lote y correo en la misma transacción: o queda ENVIADO con su correo en la cola, o nada.
  try {
    await prisma.$transaction(async (tx) => {
      const r = await tx.printBatch.updateMany({
        where: { id: b.id, estado: "ARMADO" },
        data: {
          estado: "ENVIADO", enviadoAt: new Date(), tokenHash: hash, labContactId: lab.id, labId: lab.labId,
          mensajeAlLab: opts.mensaje?.trim() || null, entregaPreferida: opts.entregaPreferida, fechaPrometida: opts.fechaPrometida ?? null,
        },
      });
      if (r.count === 0) throw new LoteError("Este lote ya fue enviado o se deshizo.");
      for (const e of b.entries) {
        const v = retiroVigente.get(e.id) ?? null;
        if (v !== e.pickupLabContactId) await tx.printBatchEntry.update({ where: { id: e.id }, data: { pickupLabContactId: v } });
      }
      // Si retira el cliente y no había elegido dónde, retira donde se imprime.
      await tx.printBatchEntry.updateMany({
        where: { batchId: b.id, quitadoAt: null, retiraCliente: true, pickupLabContactId: null },
        data: { pickupLabContactId: lab.id },
      });
      const encolado = await queueEmail({
        to: lab.email, subject: correo.subject, body: correo.body, htmlBody: correo.htmlBody,
        idempotencyKey: `lote-enviado-${b.id}`, replyTo: b.photographer.email,
      }, tx);
      if (!encolado.queued) throw new Error("Ya había un correo de envío para este lote.");
    });
  } catch (e) {
    if (e instanceof LoteError) throw e;
    console.error("[lotes] No se pudo enviar el lote", b.id, e);
    throw new LoteError(ERROR_CORREO_LAB);
  }
  await aplicarAPedidos(b, "ARMADO", "ENVIADO", photographerId);
}

type Actor = { tipo: "FOTOGRAFO"; userId: number } | { tipo: "LABORATORIO"; tokenHash: string } | { tipo: "LABORATORIO_CUENTA"; userId: number; labId: number };

/**
 * Si todos los pedidos vivos ya están entregados, cierra el lote. Un pedido cuyo espejo ya figura
 * entregado por la ruta vieja (DELIVERED o RETIRED desde Pedidos) cuenta como entregado: se le
 * completa `entregadoAt` antes de decidir.
 */
async function cerrarSiCorresponde(batchId: number): Promise<void> {
  const b = await prisma.printBatch.findUnique({ where: { id: batchId }, include: { entries: { include: { printOrder: { select: { status: true } } } } } });
  if (!b || b.estado === "CERRADO" || b.estado === "ANULADO") return;
  if (b.estado === "ARMADO" && !b.entries.some((e) => e.quitadoAt == null)) {
    await prisma.printBatch.updateMany({ where: { id: batchId, estado: "ARMADO" }, data: { estado: "ANULADO" } });
    return;
  }
  const porRutaVieja = b.entries.filter((e) => e.quitadoAt == null && e.entregadoAt == null && e.printOrder && ESPEJO_ENTREGADO.includes(e.printOrder.status));
  if (porRutaVieja.length > 0) {
    await prisma.printBatchEntry.updateMany({ where: { id: { in: porRutaVieja.map((e) => e.id) }, entregadoAt: null }, data: { entregadoAt: new Date() } });
  }
  const entradas = b.entries.map((e) => ({ quitadoAt: e.quitadoAt, entregadoAt: e.entregadoAt, estadoPedido: e.printOrder?.status ?? null }));
  if (loteCerrado(entradas, b.estado)) {
    await prisma.printBatch.updateMany({ where: { id: batchId, estado: b.estado }, data: { estado: "CERRADO", cerradoAt: new Date() } });
  }
}

export async function moverLote(batchId: number, hacia: EstadoLote, actor: Actor): Promise<void> {
  const b = await prisma.printBatch.findUnique({ where: { id: batchId }, include: { entries: { where: { quitadoAt: null } } } });
  const esDueno =
    !!b &&
    ((actor.tipo === "FOTOGRAFO" && b.photographerId === actor.userId) ||
      (actor.tipo === "LABORATORIO" && b.tokenHash != null && b.tokenHash === actor.tokenHash) ||
      (actor.tipo === "LABORATORIO_CUENTA" && b.labId != null && b.labId === actor.labId));
  if (!b || !esDueno) throw new LoteNoEncontrado("Lote no encontrado.");
  if (b.estado === hacia) {
    // Reparación: volver a aplicar el estado a los pedidos que hayan quedado atrás.
    if (hacia !== "ARMADO" && hacia !== "ANULADO") await aplicarAPedidos(b, hacia, hacia, actor.tipo === "LABORATORIO" ? null : actor.userId);
    await cerrarSiCorresponde(batchId);
    return;
  }
  if (b.estado === "ARMADO" && hacia !== "ANULADO") throw new LoteError("Para mandarlo al laboratorio usá «Enviar al laboratorio».");
  if (hacia === "ANULADO" && actor.tipo === "FOTOGRAFO") return deshacerLote(actor.userId, batchId);
  const quien = actor.tipo === "FOTOGRAFO" ? "FOTOGRAFO" : "LABORATORIO";
  if (!puedeMover(b.estado, hacia, quien, b.entregaPreferida)) throw new LoteError("Ese cambio de estado no se puede hacer.");

  const data: Prisma.PrintBatchUpdateManyMutationInput = { estado: hacia };
  const marca = MARCA_DE_TIEMPO[hacia];
  if (marca) data[marca] = new Date();
  const r = await prisma.printBatch.updateMany({ where: { id: batchId, estado: b.estado }, data });
  if (r.count === 0) throw new LoteError("El lote cambió mientras tanto. Recargá la página.");
  await aplicarAPedidos(b, b.estado, hacia, actor.tipo === "LABORATORIO" ? null : actor.userId);
  await cerrarSiCorresponde(batchId);
}

export async function quitarPedido(photographerId: number, entryId: number, motivo: "REIMPRIMIR" | "SACAR"): Promise<void> {
  const e = await prisma.printBatchEntry.findFirst({
    where: { id: entryId, quitadoAt: null, batch: { photographerId } },
    include: { batch: { select: { id: true, nombre: true, estado: true } } },
  });
  if (!e) throw new LoteNoEncontrado("Ese pedido no está en el lote.");
  const { estado } = e.batch;
  if (estado === "ANULADO") throw new LoteError("El lote está anulado.");
  if (motivo === "SACAR" && estado !== "ARMADO") throw new LoteError("El lote ya salió: usá «Reimprimir».");
  if (motivo === "REIMPRIMIR" && estado === "ARMADO") throw new LoteError("El lote todavía no salió: sacá el pedido del lote.");
  const r = await prisma.printBatchEntry.updateMany({ where: { id: entryId, quitadoAt: null }, data: { quitadoAt: new Date() } });
  if (r.count === 0) return;
  if (motivo === "REIMPRIMIR" && e.printOrderId) {
    const po = await prisma.printOrder.findUnique({ where: { id: e.printOrderId }, select: { status: true } });
    if (po && po.status !== "CREATED") {
      await cambiarEstadoDelPedido(e.printOrderId, po.status, "CREATED", photographerId, `Reimprimir: sale del ${e.batch.nombre}`);
    }
  }
  await cerrarSiCorresponde(e.batch.id);
}

/** El pedido espejo de álbum con su entrada viva en un lote no anulado; si no, LoteError. */
async function pedidoEnLote(printOrderId: number) {
  const po = await prisma.printOrder.findUnique({ where: { id: printOrderId }, select: { status: true, tags: true, customerEmail: true } });
  const entry = po?.tags.some((t) => t.startsWith("ALBUM_ORDER:"))
    ? await prisma.printBatchEntry.findFirst({
        where: { printOrderId, quitadoAt: null, batch: { estado: { not: "ANULADO" } } },
        orderBy: { id: "desc" },
        include: { batch: { select: { labContactId: true } } },
      })
    : null;
  if (!po || !entry) throw new LoteError("Ese pedido no está en ningún lote.");
  return { po, entry };
}

/** Datos para el correo «listo»: el pedido de álbum, el fotógrafo y dónde se retira. */
async function datosDelAviso(entry: { albumOrderId: number | null; retiraCliente: boolean; pickupLabContactId: number | null; batch: { labContactId: number | null } }, customerEmail: string | null) {
  const order = entry.albumOrderId
    ? await prisma.order.findUnique({
        where: { id: entry.albumOrderId },
        select: { buyerEmail: true, buyerName: true, isTest: true, origin: true,
          buyerUser: { select: { name: true } },
          album: { select: { isTest: true, userId: true, user: { select: { name: true, companyName: true, email: true, whatsapp: true, phone: true } } } } },
      })
    : null;
  if (!order || esPedidoDemo(order) || order.isTest || order.album.isTest) return null;
  const lab = entry.retiraCliente
    ? await contactoDeRetiroDelPedido(order.album.userId, entry.pickupLabContactId, entry.batch.labContactId)
    : null;
  const u = order.album.user;
  return {
    para: order.buyerEmail?.trim() || customerEmail?.trim() || null,
    cliente: order.buyerName?.trim() || order.buyerUser?.name?.trim() || order.buyerEmail,
    fotografo: nombreDelFotografo(u), contacto: u.whatsapp?.trim() || u.phone?.trim() || u.email,
    replyTo: u.email, lab,
  };
}

/**
 * Pasa un pedido de un lote a «Listo para retirar» y le avisa al cliente (una vez por entrada a ese
 * estado). Sólo pedidos espejo de álbum con entrada viva en un lote no anulado.
 * Quien llama ya autorizó al actor (dueño o laboratorio del lote: lo hace la Tarea 9).
 */
export async function marcarListoParaRetirar(printOrderId: number, quien: { userId?: number; nota: string }): Promise<void> {
  const { po, entry } = await pedidoEnLote(printOrderId);
  if (po.status === "DELIVERED" || po.status === "CANCELED") throw new LoteError("Ese pedido ya está cerrado.");
  if (!avisaAlCliente(po.status, "READY_TO_PICKUP")) return;
  const historialId = await cambiarEstadoDelPedido(printOrderId, po.status, "READY_TO_PICKUP", quien.userId ?? null, quien.nota);
  if (historialId == null) return;
  const d = await datosDelAviso(entry, po.customerEmail);
  if (!d?.para) return;
  const correo = d.lab
    ? correoListoRetiraEnLaboratorio({
        fotografo: d.fotografo, laboratorio: d.lab.nombre || d.lab.lab?.name || "el laboratorio",
        direccion: direccionDelContacto(d.lab) ?? "",
        horario: d.lab.horario, cliente: d.cliente,
      })
    : correoListoRetiraFotografo({ fotografo: d.fotografo, contactoFotografo: d.contacto });
  try {
    await queueEmail({
      to: d.para, subject: correo.subject, body: correo.body, htmlBody: correo.htmlBody,
      idempotencyKey: `pedido-listo-${printOrderId}-${historialId}`, replyTo: d.replyTo,
    });
  } catch (err) {
    console.error("[lotes] No se pudo encolar el aviso de copias listas", printOrderId, err);
  }
}

/**
 * Marca entregado un pedido de un lote (estado, historial y `entregadoAt` juntos) y cierra el lote si
 * corresponde. Si ya estaba entregado, sólo completa lo que falte (reparación).
 * Quien llama ya autorizó al actor (dueño o laboratorio del lote: lo hace la Tarea 9).
 */
export async function marcarEntregado(printOrderId: number, quien: { userId?: number; nota: string }): Promise<void> {
  const { po, entry } = await pedidoEnLote(printOrderId);
  if (po.status === "CANCELED") throw new LoteError("Ese pedido está cancelado.");
  const ahora = new Date();
  await prisma.$transaction(async (tx) => {
    if (po.status !== "DELIVERED") {
      const r = await tx.printOrder.updateMany({ where: { id: printOrderId, status: po.status }, data: { status: "DELIVERED", statusUpdatedAt: ahora } });
      if (r.count > 0) {
        await tx.printOrderStatusHistory.create({ data: { printOrderId, status: "DELIVERED", changedByUserId: quien.userId ?? null, notes: quien.nota } });
      }
    }
    await tx.printBatchEntry.updateMany({ where: { id: entry.id, entregadoAt: null }, data: { entregadoAt: ahora } });
  });
  await cerrarSiCorresponde(entry.batchId);
}

/**
 * «Entregado» desde el panel del fotógrafo: la entrada tiene que estar viva, con espejo, en un lote
 * suyo de pedidos comunes que ya salió. Si no, `LoteNoEncontrado` (la ruta responde 404).
 */
export async function entregarDesdeElPanel(photographerId: number, entryId: number): Promise<void> {
  const e = await prisma.printBatchEntry.findFirst({
    where: { id: entryId, quitadoAt: null, printOrderId: { not: null }, batch: { photographerId, tipo: "COMUNES", estado: { notIn: ["ARMADO", "ANULADO"] } } },
    select: { printOrderId: true },
  });
  if (!e?.printOrderId) throw new LoteNoEncontrado("Ese pedido no está en tus lotes.");
  await marcarEntregado(e.printOrderId, { userId: photographerId, nota: "Entregado por el fotógrafo (panel Impresiones)" });
}
