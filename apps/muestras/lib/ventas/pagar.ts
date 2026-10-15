"use server";

import { cookies } from "next/headers";
import { prisma } from "@repo/db";
import { OFFER_FORMAT_LABELS, SALE_STATEMENT_DESCRIPTOR, SALE_UNAVAILABLE_TEXT, editionLabel, isOfferFormat } from "@repo/muestras";
import { mapMercadoPagoStatusDetailToUserMessage } from "@repo/payments/frontend";
import {
  buildSplitEntriesFromDistribution,
  validateMercadoPagoSplitOrder,
  type PartnerConsentEvidence,
} from "@repo/payments/mercado-pago";
import { money } from "@repo/payments/money";
import type { CalculatedDistribution } from "@repo/payments/distribution";
import { frenarPorPedido } from "@/lib/limite";
import { getUsuario } from "@/lib/usuario";
import { puedeComprar } from "./config";
import { conciliarDesdeOrden } from "./conciliar";
import { consentimientoVigente } from "./cuentas";
import { leerFotoDelReparto, type FotoDelReparto } from "./foto-reparto";
import { configVerificada } from "./modo";
import { adaptadorDeOrdenes, leerOrden, ordenLeidaDesde, type OrdenLeida } from "./mp";
import { nombreCookieDePedido, pedidoConAcceso } from "./pedido";

/**
 * Pagar con tarjeta (etapa 8, spec D3, D13, D29): el Card Payment Brick tokeniza la tarjeta en el
 * navegador y acá se crea la Order 1:N de Mercado Pago con el reparto congelado en la reserva
 * (plataforma = `owner` con su fee; organización y fotógrafo/a = `partners`). La respuesta de la
 * creación ya se concilia (camino 1); si no se sabe qué pasó, el pedido queda pendiente y lo
 * resuelve la conciliación. Nunca se crea una segunda Order con otra `idempotencyKey`.
 *
 * Nunca se registra el token de la tarjeta, el documento ni el token de Mercado Pago.
 */
export type EntradaDePago = {
  publicId: string;
  token?: string | null;
  cardToken: string;
  paymentMethodId: string;
  installments: number;
  identification: { type: string; number: string } | null;
  deviceSessionId: string;
  payerFirstName: string;
  payerLastName: string;
};

export type ResultadoDePago =
  | { ok: true; estado: "PAID" | "PENDING" | "REJECTED"; mensaje: string }
  | { ok: false; error: string };

const no = (error: string): ResultadoDePago => ({ ok: false, error });

const VENCIDA = "La reserva venció. Volvé a la obra para empezar de nuevo.";
const NO_SE_PUEDE = "Esta obra no se puede comprar ahora.";
const MP_NO_ACEPTO = "Mercado Pago no aceptó el pago. Revisá los datos de la tarjeta o probá con otra.";
const EN_CURSO = "Estamos confirmando tu pago con Mercado Pago. No vuelvas a pagar: revisá tu pedido en unos minutos.";
const PAGADO = "¡Listo! Tu pago está confirmado.";
const REVISANDO = "Mercado Pago está revisando tu pago. Te mostramos el resultado en tu pedido apenas lo confirme.";

/** Mientras se crea la Order (una sola a la vez por pedido). */
const CREANDO = "CREATING";
/** No se sabe si Mercado Pago la creó (red o error 5xx): la conciliación lo resuelve. */
const DESCONOCIDO = "UNKNOWN_CREATE";

const ES_TOKEN_TARJETA = /^[A-Za-z0-9_-]{8,200}$/;
const ES_MEDIO = /^[a-z0-9_]{2,40}$/;
const ES_TIPO_DOC = /^[A-Za-z]{2,10}$/;
const ES_NUMERO_DOC = /^[0-9A-Za-z]{5,20}$/;
const ES_SESION = /^[A-Za-z0-9._:-]{8,200}$/;

/**
 * Del error sólo se registra la clase, el código y el estado HTTP: el mensaje de Mercado Pago puede
 * repetir el token de la tarjeta o el documento.
 */
function registrar(que: string, error: unknown): void {
  const e = error as { name?: unknown; code?: unknown; statusCode?: unknown } | null;
  console.error(`[muestras][ventas] ${que}:`, {
    name: typeof e?.name === "string" ? e.name : "Error",
    code: typeof e?.code === "string" ? e.code : null,
    statusCode: typeof e?.statusCode === "number" ? e.statusCode : null,
  });
}

const nombreValido = (s: unknown): s is string => typeof s === "string" && s.trim().length >= 1 && s.trim().length <= 60;

/** Lo que el comprador ve según el estado del pedido después de conciliar. */
function resultadoPorEstado(status: string, orden: OrdenLeida | null): ResultadoDePago {
  if (status === "PAID" || status === "PAID_NO_COPY") return { ok: true, estado: "PAID", mensaje: PAGADO };
  if (status === "REJECTED") {
    const detalle = orden?.paymentStatusDetail ?? orden?.statusDetail ?? null;
    return { ok: true, estado: "REJECTED", mensaje: mapMercadoPagoStatusDetailToUserMessage(detalle, { fallback: MP_NO_ACEPTO }) };
  }
  if (status === "PENDING_PAYMENT") return { ok: true, estado: "PENDING", mensaje: REVISANDO };
  return no(VENCIDA);
}

/**
 * Rechazo sin Order (consentimiento caído o Mercado Pago dijo que no antes de crearla): el pedido
 * pasa a `REJECTED` y la copia vuelve a estar libre.
 */
async function rechazarSinOrden(pedidoId: string, copyId: string | null, detalle: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.culturalSaleOrder.updateMany({
      where: { id: pedidoId, status: "PENDING_PAYMENT", providerOrderId: null },
      data: { status: "REJECTED", copyId: null, providerStatus: null, providerStatusDetail: detalle.slice(0, 200), lastSyncedAt: new Date() },
    });
    if (count === 0) return;
    if (copyId) {
      await tx.culturalEditionCopy.updateMany({
        where: { id: copyId, orderId: pedidoId, status: "RESERVED" },
        data: { status: "RELEASED", reservedUntil: null, orderId: null },
      });
    }
    await tx.culturalSaleEvent.create({ data: { orderId: pedidoId, source: "CREATE", fromStatus: "PENDING_PAYMENT", toStatus: "REJECTED", detail: detalle.slice(0, 500) } });
  });
}

/**
 * Mercado Pago contestó que no y la Order seguro no existe: errores de validación 4xx, de
 * consentimiento, de receptor o la guarda de escrituras en producción. Cualquier otra cosa (red,
 * 5xx, 409, una respuesta sin id) puede haber creado la Order.
 */
function seguroNoSeCreo(error: unknown): boolean {
  const e = error as { code?: unknown; statusCode?: unknown } | null;
  const code = typeof e?.code === "string" ? e.code : "";
  if (code === "CONSENT_NOT_ACTIVE" || code === "RECIPIENT_NOT_ELIGIBLE" || code === "PRODUCTION_WRITE_BLOCKED") return true;
  const status = typeof e?.statusCode === "number" ? e.statusCode : null;
  return status != null && status >= 400 && status < 500 && ![408, 409, 423, 429].includes(status);
}

/** Concilia sin dejar que un error (base, firma, red) llegue al comprador: sólo se registra su nombre. */
async function conciliarSinRomper(orden: OrdenLeida, origen: "CREATE" | "RETURN") {
  try {
    return await conciliarDesdeOrden(orden, origen);
  } catch (error) {
    console.error("[muestras][ventas] conciliar después de pagar:", { name: (error as { name?: unknown } | null)?.name ?? "Error" });
    return "FALLO" as const;
  }
}

const ROL: Record<"organizer" | "photographer" | "both", "ORGANIZER" | "PHOTOGRAPHER"> = { organizer: "ORGANIZER", photographer: "PHOTOGRAPHER", both: "ORGANIZER" };

/**
 * La distribución con los montos congelados (fijos): el `owner` (la plataforma) se queda con lo que
 * no es de un partner. Se arma directo, sin recalcular: los centavos son los de la reserva.
 */
function distribucionCongelada(totalCents: number, f: FotoDelReparto): CalculatedDistribution {
  return {
    total: money("ARS", totalCents),
    entries: [
      { recipientId: "platform", role: "PLATFORM", amount: money("ARS", f.ownerCents), ruleKind: "FIXED", priority: 0 },
      ...f.partners.map((p, i) => ({ recipientId: p.recipientId, role: ROL[p.recipientId], amount: money("ARS", p.cents), ruleKind: "FIXED" as const, priority: i + 1 })),
    ],
    rounding: "PLATFORM_ABSORBS",
    droppedRecipientIds: [],
  };
}

export async function pagarPedido(e: EntradaDePago): Promise<ResultadoDePago> {
  if (typeof e?.publicId !== "string") return no(NO_SE_PUEDE);
  const config = await configVerificada();
  const usuario = await getUsuario();
  if (!puedeComprar(usuario, config)) return no(SALE_UNAVAILABLE_TEXT);

  const galleta = (await cookies()).get(nombreCookieDePedido(e.publicId))?.value ?? null;
  const pedido = await pedidoConAcceso(e.publicId, { token: e.token ?? null, cookie: galleta });
  if (!pedido) return no("No encontramos tu pedido. Volvé a la obra para empezar de nuevo.");
  if (!frenarPorPedido("pagarPedido", pedido.publicId).allowed) return no("Hiciste muchos intentos seguidos. Esperá unos minutos.");
  // Un pedido de prueba se paga sólo en modo prueba, y uno real sólo en vivo.
  if (pedido.isTest !== (config.modo !== "LIVE")) return no(SALE_UNAVAILABLE_TEXT);

  // Doble clic o vuelta atrás: la Order ya existe, no se crea otra.
  if (pedido.providerOrderId) {
    const orden = await leerOrden(pedido.providerOrderId);
    const r = orden ? await conciliarSinRomper(orden, "RETURN") : null;
    if (r === "FALLO") return { ok: true, estado: "PENDING", mensaje: EN_CURSO };
    return resultadoPorEstado(r?.estado ?? pedido.status, orden);
  }
  if (pedido.status !== "PENDING_PAYMENT") return resultadoPorEstado(pedido.status, null);
  if (pedido.providerStatus === CREANDO || pedido.providerStatus === DESCONOCIDO) return { ok: true, estado: "PENDING", mensaje: EN_CURSO };
  if (pedido.holdExpiresAt.getTime() <= Date.now()) return no(VENCIDA);

  // Datos del Brick.
  if (!ES_TOKEN_TARJETA.test(e.cardToken ?? "") || !ES_MEDIO.test(e.paymentMethodId ?? "")) return no("Revisá los datos de la tarjeta.");
  if (e.installments !== 1) return no("Por ahora se paga en un solo pago, sin cuotas.");
  if (!ES_SESION.test(e.deviceSessionId ?? "")) return no("No pudimos preparar el pago. Recargá la página y probá de nuevo.");
  if (!nombreValido(e.payerFirstName) || !nombreValido(e.payerLastName)) return no("Escribí el nombre y el apellido del titular de la tarjeta.");
  const identificacion = e.identification && ES_TIPO_DOC.test(e.identification.type) && ES_NUMERO_DOC.test(e.identification.number)
    ? { type: e.identification.type.toUpperCase(), number: e.identification.number }
    : null;
  if (!identificacion) return no("Revisá el tipo y el número de documento del titular.");

  const foto = leerFotoDelReparto(pedido.splitSnapshot);
  if (!foto || foto.environment !== config.ambienteCuenta) return no(SALE_UNAVAILABLE_TEXT);

  // El consentimiento de cada receptor se vuelve a verificar al pagar (revisión de la tarea 6).
  const receptores = foto.organizer.userId === foto.photographer.userId ? [foto.organizer] : [foto.organizer, foto.photographer];
  for (const r of receptores) {
    const c = await consentimientoVigente(r.userId, foto.environment);
    if (!c.verificado) return no("No pudimos confirmar los datos de cobro con Mercado Pago. Probá de nuevo en unos minutos.");
    if (c.status !== "ACTIVE" || c.receiverId !== r.receiverId) {
      await rechazarSinOrden(pedido.id, pedido.copyId, `CONSENT:${r === foto.organizer ? "organizer" : "photographer"}:${c.status}`);
      return no(NO_SE_PUEDE);
    }
  }

  const adaptador = adaptadorDeOrdenes();
  if (!adaptador) return no(SALE_UNAVAILABLE_TEXT);

  // Lo que dice el ítem de la Order (señal antifraude): obra, formato y número.
  const [oferta, copia] = await Promise.all([
    prisma.culturalWorkOffer.findUnique({ where: { id: pedido.offerId }, select: { activityWorkId: true, format: true, editionKind: true, editionSize: true, proofCount: true } }),
    pedido.copyId ? prisma.culturalEditionCopy.findUnique({ where: { id: pedido.copyId }, select: { number: true, kind: true } }) : null,
  ]);
  const obra = oferta ? await prisma.culturalActivityWork.findUnique({ where: { id: oferta.activityWorkId }, select: { title: true } }) : null;
  if (!oferta || !obra || !copia) return no(NO_SE_PUEDE);
  const formato = isOfferFormat(oferta.format) ? OFFER_FORMAT_LABELS[oferta.format] : oferta.format;
  const edicion = editionLabel({ kind: copia.kind, number: copia.number, size: oferta.editionSize, editionKind: oferta.editionKind, proofCount: oferta.proofCount });
  const titulo = `${obra.title} — ${formato} ${edicion}`.slice(0, 250);

  const total = money("ARS", pedido.totalCents);
  const distribucion = distribucionCongelada(pedido.totalCents, foto);
  const partnerReceiverIds = new Map(foto.partners.map((p) => [p.recipientId, p.receiverId]));
  const consentimientos = new Map<string, PartnerConsentEvidence>(foto.partners.map((p) => [p.recipientId, { receiverId: p.receiverId, status: "ACTIVE", provider: "mercadopago" }]));
  const items = [{ title: titulo, categoryId: oferta.format === "PRINT" ? "art" : "virtual_goods", quantity: 1, unitPrice: total, externalCode: pedido.offerId }];

  // Antes de tocar Mercado Pago: lo mismo que va a validar el adaptador. Si falla acá, la Order
  // seguro no existe y el pedido sigue como estaba.
  try {
    const sumaCongelada = foto.ownerCents + foto.partners.reduce((s, p) => s + p.cents, 0);
    if (sumaCongelada !== pedido.totalCents) throw new Error("El reparto congelado no suma el total.");
    validateMercadoPagoSplitOrder({
      externalReference: pedido.externalReference,
      total,
      amountType: "fixed",
      entries: buildSplitEntriesFromDistribution(distribucion, foto.ownerUserId, partnerReceiverIds, { partnerConsentsByRecipientId: consentimientos, amountType: "fixed" }),
      deviceSessionId: e.deviceSessionId,
      payerEmail: pedido.buyerEmail,
      statementDescriptor: SALE_STATEMENT_DESCRIPTOR,
      items,
      itemsTotalRelation: "informative",
      partnerReceiverIds,
      partnerConsentsByRecipientId: consentimientos,
      ownerUserId: foto.ownerUserId,
    });
  } catch (error) {
    registrar("pago sin validar", error);
    return no("No pudimos preparar el pago. Recargá la página y probá de nuevo.");
  }

  // Una sola creación a la vez: se toma el pedido antes de llamar a Mercado Pago.
  const tomado = await prisma.culturalSaleOrder.updateMany({
    where: { id: pedido.id, status: "PENDING_PAYMENT", providerOrderId: null, OR: [{ providerStatus: null }, { providerStatus: { notIn: [CREANDO, DESCONOCIDO] } }] },
    data: { providerStatus: CREANDO },
  });
  if (tomado.count === 0) return { ok: true, estado: "PENDING", mensaje: EN_CURSO };

  let creada: { providerOrderId: string; status: string; raw?: unknown };
  try {
    creada = await adaptador.createSplitOrder({
      environment: foto.environment === "PRODUCTION" ? "production" : "sandbox",
      externalReference: pedido.externalReference,
      total,
      distribution: distribucion,
      idempotencyKey: pedido.idempotencyKey,
      deviceSessionId: e.deviceSessionId,
      paymentToken: e.cardToken,
      paymentMethodId: e.paymentMethodId,
      installments: 1,
      payerEmail: pedido.buyerEmail,
      payerProfile: { firstName: e.payerFirstName.trim(), lastName: e.payerLastName.trim(), identification: identificacion },
      statementDescriptor: SALE_STATEMENT_DESCRIPTOR,
      items,
      itemsTotalRelation: "informative",
      partnerReceiverIds,
      partnerConsentsByRecipientId: consentimientos,
      metadata: { source: "muestras", orderPublicId: pedido.publicId },
    });
  } catch (error) {
    registrar("crear la Order", error);
    if (seguroNoSeCreo(error)) {
      await rechazarSinOrden(pedido.id, pedido.copyId, "Mercado Pago rechazó la creación de la Order");
      return { ok: true, estado: "REJECTED", mensaje: MP_NO_ACEPTO };
    }
    // No sabemos si la creó: queda pendiente y nunca se reintenta con otra llave.
    await prisma.culturalSaleOrder.updateMany({ where: { id: pedido.id, providerOrderId: null }, data: { providerStatus: DESCONOCIDO, lastSyncedAt: new Date() } });
    await prisma.culturalSaleEvent.create({ data: { orderId: pedido.id, source: "CREATE", providerStatus: DESCONOCIDO, detail: "ALERT_UNKNOWN_CREATE: no se sabe si Mercado Pago creó la Order" } });
    return { ok: true, estado: "PENDING", mensaje: EN_CURSO };
  }

  // El id se guarda en una escritura inmediata: si algo falla después, la conciliación lo encuentra.
  await prisma.culturalSaleOrder.updateMany({
    where: { id: pedido.id, providerOrderId: null },
    data: { providerOrderId: creada.providerOrderId, providerStatus: creada.status, lastSyncedAt: new Date() },
  });
  const orden = ordenLeidaDesde(creada.raw) ?? (await leerOrden(creada.providerOrderId));
  if (!orden) return { ok: true, estado: "PENDING", mensaje: REVISANDO };
  // La Order ya existe y quizás ya cobró: si la conciliación falla acá, el comprador NO tiene que
  // volver a pagar; la terminan la página del pedido, el aviso o el barrido.
  const r = await conciliarSinRomper(orden, "CREATE");
  if (r === "FALLO") return { ok: true, estado: "PENDING", mensaje: REVISANDO };
  return resultadoPorEstado(r?.estado ?? "PENDING_PAYMENT", orden);
}
