import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { PENDING_HOLD_HOURS, isOrderStatus, lateCopyDecision, marksFirstSale, parseSaleExternalReference, saleOrderTransition, type OrderStatus } from "@repo/muestras";
import { leerFotoDelReparto, mismoReparto, repartoEsperado } from "./foto-reparto";
import { leerOrden, type OrdenLeida } from "./mp";
import { vencerReservas } from "./reservar-tx";

/**
 * Conciliación de pedidos con Mercado Pago (etapa 8, D29, D30). Cuatro caminos llegan acá: la
 * respuesta de la creación, la página del pedido, el aviso firmado de CLF y el barrido. Ninguno
 * confía en lo que llega: el estado sale de la Order leída (`GET /v1/orders/{id}` o la respuesta
 * de la creación) y sólo si coincide con lo congelado (referencia, total, reparto y ambiente).
 *
 * Idempotente: cada cambio es `UPDATE … WHERE status = <anterior>`; si cambió 0 filas, otro camino
 * ya lo hizo y éste no toca nada más.
 */
export type OrigenDeConciliacion = "CREATE" | "RETURN" | "NOTICE" | "SWEEP" | "ADMIN";

export type ResultadoDeConciliacion = { estado: string; cambio: boolean } | null;

const SELECCION = {
  id: true, publicId: true, status: true, isTest: true, offerId: true, copyId: true, totalCents: true, externalReference: true,
  providerOrderId: true, splitSnapshot: true, createdAt: true, holdExpiresAt: true,
} as const;

type Pedido = Prisma.CulturalSaleOrderGetPayload<{ select: typeof SELECCION }>;

const HORA = 60 * 60_000;

/** Una alerta en el historial del pedido, una sola vez por texto (el barrido repite cada 10 minutos). */
async function alertar(pedidoId: string, origen: OrigenDeConciliacion, detalle: string, providerStatus: string | null, extra?: Prisma.CulturalSaleOrderUpdateManyArgs["data"]): Promise<void> {
  const ya = await prisma.culturalSaleEvent.findFirst({ where: { orderId: pedidoId, detail: detalle }, select: { id: true } });
  if (extra) await prisma.culturalSaleOrder.updateMany({ where: { id: pedidoId }, data: extra });
  if (ya) return;
  await prisma.culturalSaleEvent.create({ data: { orderId: pedidoId, source: origen, providerStatus, detail: detalle } });
}

/** Lo primero que no coincide entre la Order y lo congelado, o `null`. */
function diferencia(p: Pedido, o: OrdenLeida): string | null {
  if (o.externalReference !== p.externalReference) return "externalReference";
  if (o.totalCents !== p.totalCents) return "total";
  const foto = leerFotoDelReparto(p.splitSnapshot);
  if (!foto) return "splitSnapshot";
  if (!mismoReparto(repartoEsperado(foto), o.splits)) return "splits";
  // Un pedido real sólo se paga con una Order real.
  if (!p.isTest && o.liveMode === false) return "liveMode";
  return null;
}

const esDevolucionParcial = (o: OrdenLeida) =>
  o.status === "PARTIALLY_REFUNDED" || [o.statusDetail, o.paymentStatusDetail].some((d) => /partial(ly)?_refunded/i.test(d ?? ""));

async function buscarPedido(o: OrdenLeida): Promise<Pedido | "OTRA_ORDEN" | null> {
  const porId = await prisma.culturalSaleOrder.findUnique({ where: { providerOrderId: o.providerOrderId }, select: SELECCION });
  if (porId) return porId;
  const publicId = o.externalReference ? parseSaleExternalReference(o.externalReference) : null;
  if (!publicId) return null;
  const porReferencia = await prisma.culturalSaleOrder.findUnique({ where: { publicId }, select: SELECCION });
  if (!porReferencia) return null;
  return porReferencia.providerOrderId && porReferencia.providerOrderId !== o.providerOrderId ? "OTRA_ORDEN" : porReferencia;
}

/**
 * La copia del pedido pagado: la suya si sigue reservada para él; si no (la reserva venció y se
 * soltó), el número libre más bajo, o `PAID_NO_COPY` si no queda ninguno (D23). Devuelve la copia
 * emitida o `null`.
 */
async function emitirParaPagado(tx: Prisma.TransactionClient, p: Pedido, ahora: Date, origen: OrigenDeConciliacion): Promise<string | null> {
  const propia = p.copyId ? await tx.culturalEditionCopy.findUnique({ where: { id: p.copyId }, select: { id: true, status: true, orderId: true } }) : null;
  if (propia && propia.orderId === p.id && (propia.status === "RESERVED" || propia.status === "ISSUED")) {
    if (propia.status === "RESERVED") {
      await tx.culturalEditionCopy.update({ where: { id: propia.id }, data: { status: "ISSUED", issuedAt: ahora, reservedUntil: null } });
    }
    return propia.id;
  }
  // Pago tardío: con la oferta bloqueada, como una compra nueva.
  await tx.$queryRaw`SELECT id FROM "CulturalWorkOffer" WHERE id = ${p.offerId} FOR UPDATE`;
  const oferta = await tx.culturalWorkOffer.findUnique({ where: { id: p.offerId }, select: { editionSize: true } });
  const filas = await vencerReservas(tx, p.offerId, p.isTest, ahora);
  const decision = oferta ? lateCopyDecision(filas, oferta.editionSize, ahora, p.isTest) : "PAID_NO_COPY";
  if (decision === "PAID_NO_COPY") {
    await tx.culturalSaleOrder.updateMany({ where: { id: p.id, status: "PAID" }, data: { status: "PAID_NO_COPY", copyId: null } });
    await tx.culturalSaleEvent.create({
      data: { orderId: p.id, source: origen, fromStatus: "PAID", toStatus: "PAID_NO_COPY", detail: "Cobrado sin copia disponible: hay que devolver" },
    });
    return null;
  }
  let copiaId: string;
  if ("reuseId" in decision) {
    await tx.culturalSaleOrder.updateMany({ where: { copyId: decision.reuseId }, data: { copyId: null } });
    await tx.culturalEditionCopy.update({ where: { id: decision.reuseId }, data: { status: "ISSUED", issuedAt: ahora, reservedUntil: null, orderId: p.id } });
    copiaId = decision.reuseId;
  } else {
    const oferta2 = await tx.culturalWorkOffer.findUnique({ where: { id: p.offerId }, select: { activityId: true } });
    const c = await tx.culturalEditionCopy.create({
      data: { offerId: p.offerId, activityId: oferta2!.activityId, isTest: p.isTest, kind: "COPY", number: decision.number, status: "ISSUED", issuedAt: ahora, orderId: p.id },
      select: { id: true },
    });
    copiaId = c.id;
  }
  await tx.culturalSaleOrder.updateMany({ where: { id: p.id }, data: { copyId: copiaId } });
  await tx.culturalSaleEvent.create({ data: { orderId: p.id, source: origen, detail: `Pago tardío: copia ${decision.number}` } });
  return copiaId;
}

/**
 * Concilia el pedido de esta Order. `null` si la Order no es de ningún pedido de Muestras (nunca
 * se dice si existe uno).
 */
export async function conciliarDesdeOrden(orden: OrdenLeida, origen: OrigenDeConciliacion, ahora: Date = new Date()): Promise<ResultadoDeConciliacion> {
  const hallado = await buscarPedido(orden);
  if (hallado === "OTRA_ORDEN") {
    const publicId = parseSaleExternalReference(orden.externalReference ?? "");
    const p = publicId ? await prisma.culturalSaleOrder.findUnique({ where: { publicId }, select: { id: true, status: true } }) : null;
    if (p) await alertar(p.id, origen, "MISMATCH:providerOrderId", orden.status);
    return p ? { estado: p.status, cambio: false } : null;
  }
  if (!hallado) return null;
  const p = hallado;

  // Una Order real sobre un pedido de prueba: no se emite nada y hay que devolver (revisión de la tarea 10).
  if (p.isTest && orden.liveMode === true) {
    await alertar(p.id, origen, "ALERT_LIVE_ON_TEST: Order real en un pedido de prueba, hay que devolver", orden.status, { refundRequestedAt: ahora });
    return { estado: p.status, cambio: false };
  }
  const distinto = diferencia(p, orden);
  if (distinto) {
    await alertar(p.id, origen, `MISMATCH:${distinto}`, orden.status);
    return { estado: p.status, cambio: false };
  }
  if (esDevolucionParcial(orden)) {
    await alertar(p.id, origen, "PARTIALLY_REFUNDED: devolución parcial en Mercado Pago (con reparto sólo se devuelve el total)", orden.status);
  }

  const actual: OrderStatus = isOrderStatus(p.status) ? p.status : "PENDING_PAYMENT";
  const { next } = saleOrderTransition(actual, { orderStatus: orden.status, paymentStatus: orden.paymentStatus });
  const datosDeMp = {
    providerStatus: orden.status.slice(0, 100),
    providerStatusDetail: (orden.paymentStatusDetail ?? orden.statusDetail)?.slice(0, 200) ?? null,
    lastSyncedAt: ahora,
    ...(p.providerOrderId ? {} : { providerOrderId: orden.providerOrderId }),
  };

  if (!next) {
    await prisma.culturalSaleOrder.updateMany({ where: { id: p.id }, data: datosDeMp });
    // Pendiente en Mercado Pago (en revisión): la reserva se extiende hasta 72 horas desde el pedido (D22).
    if (actual === "PENDING_PAYMENT") {
      const tope = new Date(p.createdAt.getTime() + PENDING_HOLD_HOURS * HORA);
      if (tope.getTime() > ahora.getTime() && tope.getTime() > p.holdExpiresAt.getTime()) {
        await prisma.culturalSaleOrder.updateMany({ where: { id: p.id, status: "PENDING_PAYMENT" }, data: { holdExpiresAt: tope } });
        if (p.copyId) {
          await prisma.culturalEditionCopy.updateMany({ where: { id: p.copyId, orderId: p.id, status: "RESERVED" }, data: { reservedUntil: tope } });
        }
      }
    }
    return { estado: actual, cambio: false };
  }

  const cambio = await prisma.$transaction(
    async (tx) => {
      const { count } = await tx.culturalSaleOrder.updateMany({
        where: { id: p.id, status: actual },
        data: {
          ...datosDeMp,
          status: next,
          ...(next === "PAID" ? { paidAt: ahora } : {}),
          ...(next === "REFUNDED" || next === "CHARGED_BACK" ? { refundedAt: ahora } : {}),
          ...(next === "REJECTED" ? { copyId: null } : {}),
        },
      });
      if (count === 0) return false;
      await tx.culturalSaleEvent.create({ data: { orderId: p.id, source: origen, fromStatus: actual, toStatus: next, providerStatus: datosDeMp.providerStatus, detail: datosDeMp.providerStatusDetail } });

      if (next === "PAID") {
        const emitida = await emitirParaPagado(tx, p, ahora, origen);
        if (emitida) {
          const oferta = await tx.culturalWorkOffer.findUnique({ where: { id: p.offerId }, select: { firstSoldAt: true } });
          if (oferta && marksFirstSale({ isTest: p.isTest, firstSoldAt: oferta.firstSoldAt })) {
            await tx.culturalWorkOffer.updateMany({ where: { id: p.offerId, firstSoldAt: null }, data: { firstSoldAt: ahora } });
          }
        }
      } else if (next === "REJECTED") {
        if (p.copyId) {
          await tx.culturalEditionCopy.updateMany({ where: { id: p.copyId, orderId: p.id, status: "RESERVED" }, data: { status: "RELEASED", reservedUntil: null, orderId: null } });
        }
      } else if (next === "REFUNDED" || next === "CHARGED_BACK") {
        if (p.copyId) {
          // Emitida: se anula y el número no vuelve. Reservada (nunca se emitió): se suelta.
          await tx.culturalEditionCopy.updateMany({
            where: { id: p.copyId, orderId: p.id, status: "ISSUED" },
            data: { status: "VOIDED", voidedAt: ahora, voidReason: next === "REFUNDED" ? "Devolución" : "Contracargo" },
          });
          const { count: soltadas } = await tx.culturalEditionCopy.updateMany({
            where: { id: p.copyId, orderId: p.id, status: "RESERVED" },
            data: { status: "RELEASED", reservedUntil: null, orderId: null },
          });
          if (soltadas > 0) await tx.culturalSaleOrder.updateMany({ where: { id: p.id }, data: { copyId: null } });
        }
      }
      return true;
    },
    { timeout: 20_000, maxWait: 5_000 },
  );
  if (!cambio) {
    const ahoraEs = await prisma.culturalSaleOrder.findUnique({ where: { id: p.id }, select: { status: true } });
    return { estado: ahoraEs?.status ?? actual, cambio: false };
  }
  const final = await prisma.culturalSaleOrder.findUnique({ where: { id: p.id }, select: { status: true } });
  return { estado: final?.status ?? next, cambio: true };
}

/**
 * Concilia leyendo la Order en Mercado Pago. Con `providerOrderId` sirve también para el aviso de
 * CLF y para un pedido que no llegó a guardar su id (se encuentra por `external_reference`).
 * `null` si no hay Order o no se pudo leer: entonces no cambia nada.
 */
export async function conciliarPedido(cual: { publicId: string } | { providerOrderId: string }, origen: OrigenDeConciliacion): Promise<ResultadoDeConciliacion> {
  let providerOrderId: string | null;
  if ("providerOrderId" in cual) providerOrderId = cual.providerOrderId;
  else {
    const p = await prisma.culturalSaleOrder.findUnique({ where: { publicId: cual.publicId }, select: { providerOrderId: true } });
    providerOrderId = p?.providerOrderId ?? null;
  }
  if (!providerOrderId) return null;
  const orden = await leerOrden(providerOrderId);
  return orden ? conciliarDesdeOrden(orden, origen) : null;
}
