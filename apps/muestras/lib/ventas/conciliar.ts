import "server-only";
import { randomInt } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import {
  PENDING_HOLD_HOURS, certificatePayload, isOrderStatus, lateCopyDecision, marksFirstSale, newCertificateCode, parseSaleExternalReference,
  saleOrderTransition, type OrderStatus,
} from "@repo/muestras";
import { firmarCertificado, kidActual } from "./certificado";
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
  // Un pedido real sólo se paga con una Order que Mercado Pago marca como real: si no lo dice, no
  // alcanza (revisión de las tareas 11 a 14).
  if (!p.isTest && o.liveMode !== true) return "liveMode";
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
    // Sólo una fila liberada (las reservas vencidas ya las soltó `vencerReservas`): si cambió en el
    // medio, se deshace todo y el próximo camino lo vuelve a intentar.
    const { count } = await tx.culturalEditionCopy.updateMany({
      where: { id: decision.reuseId, status: "RELEASED" },
      data: { status: "ISSUED", issuedAt: ahora, reservedUntil: null, orderId: p.id },
    });
    if (count !== 1) throw new Error("La copia libre cambió mientras se emitía el pago tardío.");
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
    await alertar(p.id, origen, "ALERT_LIVE_ON_TEST: Order real en un pedido de prueba, hay que devolver", orden.status);
    // Cuando Mercado Pago confirma la devolución total, queda anotada (el pedido sigue sin emitir nada).
    const devuelta = saleOrderTransition("PAID", { orderStatus: orden.status, paymentStatus: orden.paymentStatus }).next === "REFUNDED";
    if (devuelta) {
      const { count } = await prisma.culturalSaleOrder.updateMany({ where: { id: p.id, refundedAt: null }, data: { refundedAt: ahora } });
      if (count) await prisma.culturalSaleEvent.create({ data: { orderId: p.id, source: origen, providerStatus: orden.status, detail: "Devuelta en Mercado Pago la Order real del pedido de prueba" } });
    } else {
      await prisma.culturalSaleOrder.updateMany({ where: { id: p.id, refundRequestedAt: null }, data: { refundRequestedAt: ahora } });
    }
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
    // Mercado Pago dice "pagado" pero el pedido ya se dio por rechazado (por ejemplo, la creación
    // falló sin respuesta y se reintentó): la plata entró y no hay copia. Alerta y devolución pedida.
    if (actual === "REJECTED" && saleOrderTransition("PENDING_PAYMENT", { orderStatus: orden.status, paymentStatus: orden.paymentStatus }).next === "PAID") {
      await prisma.culturalSaleOrder.updateMany({ where: { id: p.id, refundRequestedAt: null }, data: { refundRequestedAt: ahora } });
      await alertar(p.id, origen, "ALERT_PAID_ON_TERMINAL: Mercado Pago cobró un pedido rechazado, hay que devolver", orden.status);
      return { estado: actual, cambio: false };
    }
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
  const final = await prisma.culturalSaleOrder.findUnique({ where: { id: p.id }, select: { status: true, copyId: true } });
  // El certificado va aparte de la transacción: si algo falla al firmarlo, el pago ya quedó
  // registrado y el barrido lo vuelve a intentar.
  if (final?.status === "PAID" && final.copyId) await certificarCopia(final.copyId, ahora);
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

export type ResultadoDeCertificado = "OK" | "YA_TENIA" | "SIN_CLAVE" | "SIN_DATOS";

const SIN_CLAVE = "ALERT_NO_CERT_KEY: falta la clave para firmar el certificado";
const SIN_DATOS = "ALERT_NO_CERT_DATA: faltan datos para el certificado (original o firma)";

/**
 * Pone el certificado a una copia emitida (D18–D20, `emitirCopia` del plan): código nuevo (se
 * reintenta si choca), el texto canónico con los datos congelados y la firma Ed25519. Si falta la
 * clave, no emite: el pedido sigue pagado con una alerta y el barrido reintenta. Idempotente.
 */
export async function certificarCopia(copyId: string, ahora: Date = new Date()): Promise<ResultadoDeCertificado> {
  const copia = await prisma.culturalEditionCopy.findUnique({
    where: { id: copyId },
    select: { id: true, status: true, kind: true, number: true, isTest: true, issuedAt: true, offerId: true, orderId: true, certificateCode: true },
  });
  if (!copia || copia.status !== "ISSUED") return "SIN_DATOS";
  if (copia.certificateCode) return "YA_TENIA";
  const avisar = async (detalle: string) => {
    if (!copia.orderId) return;
    const ya = await prisma.culturalSaleEvent.findFirst({ where: { orderId: copia.orderId, detail: detalle }, select: { id: true } });
    if (!ya) await prisma.culturalSaleEvent.create({ data: { orderId: copia.orderId, source: "SWEEP", detail: detalle } });
  };
  const kid = kidActual();
  if (!kid) {
    await avisar(SIN_CLAVE);
    return "SIN_CLAVE";
  }
  const oferta = await prisma.culturalWorkOffer.findUnique({
    where: { id: copia.offerId },
    select: { activityId: true, activityWorkId: true, format: true, editionKind: true, editionSize: true, proofCount: true, paper: true, widthCm: true, heightCm: true },
  });
  const [actividad, obra, archivo, pedido] = oferta
    ? await Promise.all([
        prisma.culturalActivity.findUnique({ where: { id: oferta.activityId }, select: { title: true } }),
        prisma.culturalActivityWork.findUnique({ where: { id: oferta.activityWorkId }, select: { title: true, authorName: true } }),
        prisma.culturalSaleFile.findUnique({ where: { activityWorkId: oferta.activityWorkId }, select: { sha256: true } }),
        copia.orderId ? prisma.culturalSaleOrder.findUnique({ where: { id: copia.orderId }, select: { buyerName: true, buyerOnCertificate: true } }) : null,
      ])
    : [null, null, null, null];
  if (!oferta || !actividad || !obra || !archivo?.sha256) {
    await avisar(SIN_DATOS);
    return "SIN_DATOS";
  }
  const emitida = copia.issuedAt ?? ahora;
  for (let intento = 0; intento < 5; intento++) {
    const code = newCertificateCode(randomInt);
    const payload = certificatePayload({
      code, kid,
      activityTitle: actividad.title,
      workTitle: obra.title,
      authorName: obra.authorName,
      format: oferta.format,
      editionKind: oferta.editionKind,
      kind: copia.kind,
      number: copia.number,
      editionSize: oferta.editionSize,
      proofCount: oferta.proofCount,
      paper: oferta.paper,
      widthCm: oferta.widthCm,
      heightCm: oferta.heightCm,
      originalSha256: archivo.sha256,
      issuedAt: emitida,
      buyerName: pedido?.buyerName ?? null,
      buyerOnCertificate: pedido?.buyerOnCertificate ?? false,
      isTest: copia.isTest,
    });
    const firma = firmarCertificado(payload);
    try {
      await prisma.culturalEditionCopy.updateMany({
        where: { id: copia.id, certificateCode: null },
        data: { certificateCode: code, certificateKid: firma.kid, certificatePayload: payload, certificateSignature: firma.signature, issuedAt: emitida },
      });
      return "OK";
    } catch (err) {
      // El código chocó con otro (único): se prueba con uno nuevo.
      if ((err as { code?: string })?.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("No se pudo generar un código de certificado único.");
}
