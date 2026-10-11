import "server-only";
import type { Prisma } from "@repo/db";
import {
  PENDING_HOLD_HOURS, RESERVATION_MINUTES, deliveryOptions, nextEditionNumber, offerSellingPrice, receiverPlan, saleAmounts, saleExternalReference,
  type Delivery, type EditionRow,
} from "@repo/muestras";
import { obrasVendibles } from "./consultas";
import { evaluarOferta } from "./evaluar";

/**
 * La reserva del número de copia (etapa 8, spec D21, D22, D25), dentro de una transacción. Va
 * aparte de la acción (`reservar.ts`) para que el test de concurrencia la corra contra una base
 * real, y para que no sea una acción de servidor que se pueda llamar desde afuera.
 *
 * Orden de los bloqueos (siempre el mismo): la oferta `FOR UPDATE`, después la configuración de la
 * venta `FOR SHARE` (la organización no cambia el reparto en el medio). Dos compras de la misma
 * oferta se ordenan por el bloqueo; el índice único `(offerId, isTest, kind, number)` es la última red.
 */
export type DireccionDeEnvio = { calle: string; numero: string; pisoDepto: string | null; ciudad: string; provincia: string; codigoPostal: string };

export type EntradaDeReserva = {
  offerId: string;
  delivery: Delivery;
  comprador: { nombre: string; email: string; telefono: string | null };
  direccion: DireccionDeEnvio | null;
  nombreEnCertificado: boolean;
  termsVersion: string;
  /** Ambiente de la numeración y de las cuentas de cobro (D4, D13). */
  isTest: boolean;
  ambienteCuenta: "SANDBOX" | "PRODUCTION";
  /** Cuenta de la plataforma en Mercado Pago (`owner` de la Order). */
  ownerUserId: string;
  publicId: string;
  accessTokenHash: string;
  idempotencyKey: string;
};

export type ResultadoDeReserva =
  | { ok: true; orderId: string; publicId: string; totalCents: number; holdExpiresAt: Date; copyNumber: number }
  | { ok: false; error: string };

export const AGOTADO = "Se vendieron todas las copias de este formato.";
export const NO_SE_PUEDE = "Esta obra no se puede comprar ahora.";

const MIN = 60_000;
const HORA = 60 * MIN;

/** Vence las reservas viejas de la oferta y devuelve las filas de la numeración actualizadas. */
async function vencerReservas(tx: Prisma.TransactionClient, offerId: string, isTest: boolean, ahora: Date): Promise<EditionRow[]> {
  const vencidas = await tx.culturalEditionCopy.findMany({
    where: { offerId, isTest, kind: "COPY", status: "RESERVED", reservedUntil: { lte: ahora } },
    select: { id: true, orderId: true },
  });
  for (const c of vencidas) {
    const pedido = c.orderId
      ? await tx.culturalSaleOrder.findUnique({ where: { id: c.orderId }, select: { id: true, status: true, providerOrderId: true, createdAt: true } })
      : null;
    if (pedido?.status === "PENDING_PAYMENT" && pedido.providerOrderId) {
      // Mercado Pago dejó el pago pendiente (D22): la reserva se extiende hasta 72 horas desde el pedido.
      const tope = new Date(pedido.createdAt.getTime() + PENDING_HOLD_HOURS * HORA);
      if (tope.getTime() > ahora.getTime()) {
        await tx.culturalEditionCopy.updateMany({ where: { id: c.id, status: "RESERVED" }, data: { reservedUntil: tope } });
        continue;
      }
      // Pasadas las 72 horas, lo resuelve la conciliación (que pregunta a Mercado Pago): no se libera acá.
      continue;
    }
    if (pedido?.status === "PENDING_PAYMENT") {
      // Sin Order: el pedido vence y suelta la copia. Un pago tardío nunca recupera esta fila (D23).
      const { count } = await tx.culturalSaleOrder.updateMany({ where: { id: pedido.id, status: "PENDING_PAYMENT", providerOrderId: null }, data: { status: "EXPIRED", copyId: null } });
      if (count > 0) {
        await tx.culturalSaleEvent.create({ data: { orderId: pedido.id, source: "SWEEP", fromStatus: "PENDING_PAYMENT", toStatus: "EXPIRED", detail: "Reserva vencida sin pago" } });
      }
    } else if (pedido) {
      // Cualquier otro estado ya no necesita la reserva: el pedido la suelta.
      await tx.culturalSaleOrder.updateMany({ where: { id: pedido.id, copyId: c.id }, data: { copyId: null } });
    }
    await tx.culturalEditionCopy.updateMany({ where: { id: c.id, status: "RESERVED" }, data: { status: "RELEASED", reservedUntil: null, orderId: null } });
  }
  return tx.culturalEditionCopy.findMany({
    where: { offerId, isTest, kind: "COPY" },
    select: { id: true, number: true, status: true, reservedUntil: true, kind: true, isTest: true },
  });
}

export async function reservarEnTransaccion(tx: Prisma.TransactionClient, e: EntradaDeReserva, ahora: Date): Promise<ResultadoDeReserva> {
  const no = (error: string): ResultadoDeReserva => ({ ok: false, error });
  const bloqueada = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "CulturalWorkOffer" WHERE id = ${e.offerId} FOR UPDATE`;
  if (bloqueada.length === 0) return no(NO_SE_PUEDE);
  const oferta = await tx.culturalWorkOffer.findUnique({ where: { id: e.offerId } });
  if (!oferta) return no(NO_SE_PUEDE);
  await tx.$queryRaw`SELECT id FROM "CulturalSaleSetup" WHERE "activityId" = ${oferta.activityId} FOR SHARE`;
  const [setup, actividad] = await Promise.all([
    tx.culturalSaleSetup.findUnique({ where: { activityId: oferta.activityId } }),
    tx.culturalActivity.findUnique({ where: { id: oferta.activityId }, select: { reviewStatus: true, isCancelled: true, endsAt: true } }),
  ]);
  if (!setup || !actividad) return no(NO_SE_PUEDE);

  const filas = await vencerReservas(tx, oferta.id, e.isTest, ahora);
  const siguiente = nextEditionNumber(filas, oferta.editionSize, ahora, "COPY", e.isTest);
  if (!siguiente) return no(AGOTADO);

  // Lo mismo que ve la página (D11), leído dentro de la transacción.
  const [vendibles, terminos, cuentas, original, firma] = await Promise.all([
    obrasVendibles(oferta.activityId, oferta.authorUserId, tx),
    tx.culturalSaleAuthorTerms.findUnique({ where: { activityId_userId: { activityId: oferta.activityId, userId: oferta.authorUserId } }, select: { splitVersion: true } }),
    tx.culturalPayoutAccount.findMany({
      where: { userId: { in: [setup.organizerUserId, oferta.authorUserId] }, environment: e.ambienteCuenta },
      select: { userId: true, consentStatus: true, receiverId: true },
    }),
    tx.culturalSaleFile.findUnique({ where: { activityWorkId: oferta.activityWorkId }, select: { status: true } }),
    tx.culturalAuthorSignature.findUnique({ where: { userId: oferta.authorUserId }, select: { userId: true } }),
  ]);
  const evaluacion = evaluarOferta(oferta, {
    actividad,
    setup: { status: setup.status, splitVersion: setup.splitVersion, organizerUserId: setup.organizerUserId },
    vendibles: new Map(vendibles.map((v) => [v.activityWorkId, { authorUserId: v.authorUserId, authorName: v.authorName }])),
    terminos: new Map(terminos ? [[oferta.authorUserId, terminos.splitVersion]] : []),
    consentimientos: new Map(cuentas.map((c) => [c.userId, c.consentStatus])),
    originales: new Map(original ? [[oferta.activityWorkId, original.status]] : []),
    firmas: new Set(firma ? [firma.userId] : []),
    copias: new Map([[oferta.id, filas]]),
    isTest: e.isTest,
    ahora,
  });
  if (!evaluacion.comprable.ok) return no(NO_SE_PUEDE);
  const precio = offerSellingPrice(oferta);
  if (precio == null) return no(NO_SE_PUEDE);
  const cuentaOrg = cuentas.find((c) => c.userId === setup.organizerUserId);
  const cuentaFoto = cuentas.find((c) => c.userId === oferta.authorUserId);
  if (!cuentaOrg?.receiverId || !cuentaFoto?.receiverId) return no(NO_SE_PUEDE);

  if (!deliveryOptions(setup, oferta.format).includes(e.delivery)) {
    return no(e.delivery === "SHIPPING" && oferta.format === "PRINT" ? "Esta muestra no hace envíos: elegí retirarla en la sede." : "Elegí una forma de entrega disponible.");
  }
  if (e.delivery === "SHIPPING" && (setup.shippingCostArs == null || !e.direccion)) return no("Completá la dirección de envío.");

  const montos = saleAmounts({
    priceArs: precio,
    shippingArs: e.delivery === "SHIPPING" ? setup.shippingCostArs ?? 0 : 0,
    platformFeeBps: setup.platformFeeBps,
    organizerBps: setup.organizerBps,
  });
  const organizer = { userId: setup.organizerUserId, receiverId: cuentaOrg.receiverId };
  const photographer = { userId: oferta.authorUserId, receiverId: cuentaFoto.receiverId };
  const plan = receiverPlan({ amounts: montos, organizer, photographer });
  const holdExpiresAt = new Date(ahora.getTime() + RESERVATION_MINUTES * MIN);

  // La copia: se reutiliza la fila libre (liberada o reserva vencida) o se crea con el número que toca.
  let copyId: string;
  if ("reuseId" in siguiente) {
    // Si un pedido viejo la seguía apuntando, la suelta (`copyId` es único).
    await tx.culturalSaleOrder.updateMany({ where: { copyId: siguiente.reuseId }, data: { copyId: null } });
    const { count } = await tx.culturalEditionCopy.updateMany({
      where: { id: siguiente.reuseId, status: { in: ["RELEASED", "RESERVED"] } },
      data: { status: "RESERVED", reservedUntil: holdExpiresAt, orderId: null },
    });
    if (count === 0) return no(NO_SE_PUEDE);
    copyId = siguiente.reuseId;
  } else {
    const c = await tx.culturalEditionCopy.create({
      data: { offerId: oferta.id, activityId: oferta.activityId, isTest: e.isTest, kind: "COPY", number: siguiente.number, status: "RESERVED", reservedUntil: holdExpiresAt },
      select: { id: true },
    });
    copyId = c.id;
  }

  const pedido = await tx.culturalSaleOrder.create({
    data: {
      publicId: e.publicId,
      accessTokenHash: e.accessTokenHash,
      activityId: oferta.activityId,
      offerId: oferta.id,
      copyId,
      isTest: e.isTest,
      buyerName: e.comprador.nombre,
      buyerEmail: e.comprador.email,
      buyerPhone: e.comprador.telefono,
      buyerOnCertificate: e.nombreEnCertificado,
      delivery: e.delivery,
      ...(e.delivery === "SHIPPING" && e.direccion ? { shippingAddress: e.direccion } : {}),
      priceArs: precio,
      shippingArs: montos.shippingCents / 100,
      totalCents: montos.totalCents,
      platformCents: montos.platformCents,
      organizerCents: montos.organizerCents,
      photographerCents: montos.photographerCents,
      splitSnapshot: {
        v: 1,
        platformFeeBps: setup.platformFeeBps,
        organizerBps: setup.organizerBps,
        photographerBps: setup.photographerBps,
        splitVersion: setup.splitVersion,
        environment: e.ambienteCuenta,
        organizer,
        photographer,
        ownerUserId: e.ownerUserId,
        ownerCents: plan.ownerCents,
        partners: plan.partners,
      },
      status: "PENDING_PAYMENT",
      fulfillment: oferta.format === "PRINT" ? "PENDING" : "NONE",
      externalReference: saleExternalReference(e.publicId),
      idempotencyKey: e.idempotencyKey,
      termsVersion: e.termsVersion,
      holdExpiresAt,
    },
    select: { id: true },
  });
  await tx.culturalEditionCopy.update({ where: { id: copyId }, data: { orderId: pedido.id } });
  await tx.culturalSaleEvent.create({ data: { orderId: pedido.id, source: "CREATE", toStatus: "PENDING_PAYMENT", detail: `Copia ${siguiente.number} reservada` } });
  return { ok: true, orderId: pedido.id, publicId: e.publicId, totalCents: montos.totalCents, holdExpiresAt, copyNumber: siguiente.number };
}
