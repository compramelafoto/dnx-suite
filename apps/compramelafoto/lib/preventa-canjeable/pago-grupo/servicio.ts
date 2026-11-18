/**
 * Varios packs de preventa en UN solo pago: conexión con la base y con Mercado Pago.
 * Las reglas están en `reglas.ts` y los pasos (probados) en `orquestar.ts`.
 *
 * Nada de esto toca la tabla `Order` con columnas nuevas: el grupo vive en `OrderPaymentGroup`.
 * Si esa tabla todavía no está aplicada en la base, las lecturas devuelven "sin grupo" y todo
 * sigue como antes (un pago por pack).
 */
import { randomUUID } from "node:crypto";
import { OrderOrigin, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createPreference, getPaymentById } from "@/lib/mercadopago";
import { bloqueaCheckoutPro } from "@/lib/split-1n-piloto/snapshot";
import { resolveAlbumOrderMercadoPagoCredentials } from "@/lib/mercadopago/resolve-album-order-mp-credentials";
import { buildMercadoPagoUnauthorizedRefresher } from "@/lib/mercadopago/mp-oauth-token-refresh";
import { computeAlbumOrderCheckoutLine } from "@/lib/mercadopago/album-order-mp-preference";
import { finalizeAlbumOrderMercadoPagoApproved } from "@/lib/mercadopago/finalize-album-order-mp-approved";
import { reverseAlbumOrderMercadoPagoIfWasPaid } from "@/lib/mercadopago/reverse-album-order-mercado-pago";
import { ensureWebhookIdempotency } from "@/lib/antifraud/webhook";
import { registerAuditEvent } from "@/lib/antifraud/audit";
import { queueEmail } from "@/lib/email-queue";
import { readPackDefinitionIdFromOrderPricingSnapshot } from "@/lib/preventa-canjeable/order-checkout-kind";
import {
  createPackAccessTokenForOrder,
  ensurePackAccessTokenForOrder,
} from "@/lib/preventa-canjeable/pack-access-tokens";
import { rutaDelPackConCodigo } from "@/lib/preventa-canjeable/destino-pago-exitoso";
import {
  armarCobroGrupo,
  mismosPedidos,
  referenciaGrupoPreventa,
  validarPedidosParaAgrupar,
  type LineaCobroGrupo,
  type MotivoNoAgrupable,
} from "./reglas";
import {
  finalizarGrupoConDeps,
  procesarAvisoGrupoConDeps,
  revertirGrupoConDeps,
  type GrupoGuardado,
  type PagoLeido,
  type ResultadoFinalizarGrupo,
} from "./orquestar";
import { armarComprobanteGrupo, type PackDelComprobanteGrupo } from "./correo-grupo";

const LOG = "[preventa-grupo]";

function appUrl(): string {
  return (
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://compramelafoto.com")
  );
}

function aGrupoGuardado(row: { id: string; orderIds: number[]; status: string; mpPaymentId: string | null }): GrupoGuardado {
  return { id: row.id, orderIds: [...row.orderIds], status: row.status, mpPaymentId: row.mpPaymentId };
}

export async function cargarGrupoPreventa(grupoId: string): Promise<GrupoGuardado | null> {
  try {
    const row = await prisma.orderPaymentGroup.findUnique({ where: { id: grupoId } });
    return row ? aGrupoGuardado(row) : null;
  } catch (err: unknown) {
    console.error(`${LOG} no se pudo leer el grupo`, { grupoId, err: String(err) });
    return null;
  }
}

/** Último grupo que incluye el pedido, o null (también si la tabla no está aplicada). */
export async function buscarGrupoDelPedido(orderId: number): Promise<GrupoGuardado | null> {
  try {
    const row = await prisma.orderPaymentGroup.findFirst({
      where: { orderIds: { has: orderId } },
      orderBy: { createdAt: "desc" },
    });
    return row ? aGrupoGuardado(row) : null;
  } catch (err: unknown) {
    console.error(`${LOG} no se pudo buscar el grupo del pedido`, { orderId, err: String(err) });
    return null;
  }
}

const MENSAJE_NO_AGRUPABLE: Record<MotivoNoAgrupable, string> = {
  pocos_pedidos: "Para pagar juntos hacen falta al menos dos packs.",
  pedido_inexistente: "No encontramos uno de los pedidos.",
  albumes_distintos: "Los packs son de álbumes distintos.",
  otro_comprador: "Los pedidos no son del mismo comprador.",
  no_es_preventa: "Uno de los pedidos no es un pack de preventa.",
  no_es_mercado_pago: "Uno de los pedidos no se paga con Mercado Pago.",
  prueba: "Uno de los pedidos es de prueba.",
  no_pagable: "Uno de los packs ya está pagado o no se puede pagar.",
  moneda: "Uno de los pedidos es en otra moneda.",
  cobro_dividido: "Uno de los pedidos se paga desde su propia página.",
  sin_monto: "Uno de los pedidos no tiene monto.",
  viejo: "Uno de los pedidos es de otra compra.",
};

export type ResultadoGrupoConPago =
  | { ok: true; grupoId: string; initPoint: string; reused: boolean; orderIds: number[] }
  | { ok: false; codigo: string; error: string; httpStatus: number };

/**
 * Agrupa los pedidos (uno por pack) de una misma compra y devuelve el link de UN solo pago.
 * Si el mismo conjunto ya estaba agrupado y sin pagar, reusa ese grupo.
 */
export async function crearGrupoConPago(params: {
  orderIds: number[];
  buyerEmail: string;
}): Promise<ResultadoGrupoConPago> {
  const ids = [...new Set(params.orderIds)].filter((id) => Number.isInteger(id) && id > 0);
  const pedidos = await prisma.order.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      albumId: true,
      buyerEmail: true,
      status: true,
      origin: true,
      checkoutPaymentSource: true,
      isTest: true,
      currency: true,
      totalCents: true,
      createdAt: true,
      pricingSnapshot: true,
    },
  });
  const validacion = validarPedidosParaAgrupar({
    orderIdsPedidos: ids,
    pedidos: pedidos.map((p) => ({
      ...p,
      status: String(p.status),
      origin: String(p.origin),
      checkoutPaymentSource: String(p.checkoutPaymentSource),
      bloqueaCheckoutPro: bloqueaCheckoutPro(p.pricingSnapshot),
    })),
    buyerEmail: params.buyerEmail,
    ahora: new Date(),
  });
  if (!validacion.ok) {
    console.info(`${LOG} no_agrupable`, { orderIds: ids, motivo: validacion.motivo, orderId: validacion.orderId });
    return { ok: false, codigo: `NO_AGRUPABLE_${validacion.motivo.toUpperCase()}`, error: MENSAJE_NO_AGRUPABLE[validacion.motivo], httpStatus: 409 };
  }

  let grupo: GrupoGuardado | null = null;
  try {
    const candidatos = await prisma.orderPaymentGroup.findMany({
      where: { orderIds: { has: validacion.orderIds[0] }, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    const mismo = candidatos.find((c) => mismosPedidos(c.orderIds, validacion.orderIds));
    if (mismo) grupo = aGrupoGuardado(mismo);
    else {
      const creado = await prisma.orderPaymentGroup.create({
        data: {
          id: randomUUID(),
          albumId: validacion.albumId,
          buyerEmail: params.buyerEmail.trim(),
          orderIds: validacion.orderIds,
          totalArs: validacion.totalArs,
          status: "PENDING",
        },
      });
      grupo = aGrupoGuardado(creado);
    }
  } catch (err: unknown) {
    // Tabla sin aplicar u otro error de base: la pantalla sigue con un pago por pack.
    console.error(`${LOG} no se pudo crear el grupo`, { orderIds: ids, err: String(err) });
    return { ok: false, codigo: "GRUPO_NO_DISPONIBLE", error: "No se pudo armar el pago conjunto.", httpStatus: 503 };
  }

  const pref = await asegurarPreferenciaGrupo(grupo.id);
  if (!pref.ok) return pref;
  return { ...pref, orderIds: validacion.orderIds };
}

/** Preferencia de Checkout Pro del grupo: un ítem por pedido, comisión sumada. */
export async function asegurarPreferenciaGrupo(
  grupoId: string,
  options?: { forceRegenerate?: boolean },
): Promise<
  | { ok: true; grupoId: string; initPoint: string; reused: boolean }
  | { ok: false; codigo: string; error: string; httpStatus: number }
> {
  const row = await prisma.orderPaymentGroup.findUnique({ where: { id: grupoId } });
  if (!row) return { ok: false, codigo: "GRUPO_INEXISTENTE", error: "No encontramos el pago conjunto.", httpStatus: 404 };
  if (row.status !== "PENDING") {
    return { ok: false, codigo: "GRUPO_NO_PENDIENTE", error: "Este pago conjunto ya no está pendiente.", httpStatus: 409 };
  }
  const pedidos = await prisma.order.findMany({ where: { id: { in: row.orderIds } }, include: { items: true } });
  const validacion = validarPedidosParaAgrupar({
    orderIdsPedidos: row.orderIds,
    pedidos: pedidos.map((p) => ({
      ...p,
      status: String(p.status),
      origin: String(p.origin),
      checkoutPaymentSource: String(p.checkoutPaymentSource),
      bloqueaCheckoutPro: bloqueaCheckoutPro(p.pricingSnapshot),
      // Reabrir el pago de un grupo ya armado no depende de la antigüedad.
      createdAt: new Date(),
    })),
    buyerEmail: row.buyerEmail,
    ahora: new Date(),
  });
  if (!validacion.ok) {
    return { ok: false, codigo: `NO_AGRUPABLE_${validacion.motivo.toUpperCase()}`, error: MENSAJE_NO_AGRUPABLE[validacion.motivo], httpStatus: 409 };
  }
  if (!options?.forceRegenerate && row.mpInitPoint && row.mpPreferenceId && row.totalArs === validacion.totalArs) {
    return { ok: true, grupoId, initPoint: row.mpInitPoint, reused: true };
  }

  const album = await prisma.album.findUnique({
    where: { id: validacion.albumId },
    select: { userId: true, eventId: true, selectedLabId: true },
  });
  const creds = await resolveAlbumOrderMercadoPagoCredentials({
    photographerUserId: album?.userId ?? null,
    eventId: album?.eventId ?? null,
  });
  if (!creds.ok) return { ok: false, codigo: creds.code, error: creds.error, httpStatus: 400 };

  const packIds = pedidos
    .map((p) => readPackDefinitionIdFromOrderPricingSnapshot(p.pricingSnapshot))
    .filter((id): id is number => id != null);
  const packs = packIds.length
    ? await prisma.packDefinition.findMany({ where: { id: { in: packIds } }, select: { id: true, name: true } })
    : [];
  const nombrePorPack = new Map(packs.map((p) => [p.id, p.name]));

  const lineas: LineaCobroGrupo[] = [];
  for (const order of pedidos) {
    const linea = await computeAlbumOrderCheckoutLine(order, album, creds.collectorType);
    const packId = readPackDefinitionIdFromOrderPricingSnapshot(order.pricingSnapshot);
    lineas.push({
      orderId: order.id,
      titulo: (packId != null ? nombrePorPack.get(packId) : null) ?? "Pack de preventa",
      totalArs: linea.total,
      comisionArs: linea.marketplaceFee,
    });
  }
  const cobro = armarCobroGrupo(lineas);
  const primerPedido = Math.min(...validacion.orderIds);

  const { initPoint, preferenceId } = await createPreference(
    {
      title: cobro.titulo,
      total: cobro.total,
      marketplaceFee: cobro.marketplaceFee,
      externalReference: referenciaGrupoPreventa(grupoId),
      items: cobro.items,
      metadata: {
        // Pantalla de pago exitoso y aviso: entran por el primer pedido y reconocen el grupo por la referencia.
        orderType: "ALBUM_ORDER",
        orderId: primerPedido,
        component: "DIGITAL",
        checkoutKind: "PREVENTA_PACK",
        paymentGroupId: grupoId,
        orderIds: validacion.orderIds.join(","),
      },
    },
    {
      accessTokenOverride: creds.accessToken,
      refreshAccessTokenOnUnauthorized: buildMercadoPagoUnauthorizedRefresher({
        ownerType: "USER",
        ownerId: creds.collectorUserId,
      }),
    },
  );

  await prisma.orderPaymentGroup.update({
    where: { id: grupoId },
    data: { mpInitPoint: initPoint, mpPreferenceId: preferenceId, totalArs: cobro.total },
  });
  console.info(`${LOG} preferencia`, {
    grupoId,
    orderIds: validacion.orderIds,
    total: cobro.total,
    marketplaceFee: cobro.marketplaceFee,
  });
  return { ok: true, grupoId, initPoint, reused: false };
}

async function leerPagoConToken(paymentId: string, accessTokenOverride?: string): Promise<PagoLeido> {
  let pay;
  try {
    pay = await getPaymentById(paymentId, { accessTokenOverride });
  } catch {
    pay = await getPaymentById(paymentId, {});
  }
  return {
    externalReference: pay.external_reference,
    status: String(pay.status),
    statusDetail: pay.status_detail ?? null,
    monto: Number(pay.transaction_amount),
    moneda: pay.currency_id ?? null,
  };
}

/** Confirma todos los pedidos del grupo con un pago aprobado (webhook, pago exitoso, cron). */
export async function finalizarGrupoPreventa(params: {
  grupoId: string;
  paymentId: string;
  accessTokenOverride?: string;
}): Promise<ResultadoFinalizarGrupo> {
  const r = await finalizarGrupoConDeps(
    {
      cargarGrupo: cargarGrupoPreventa,
      cargarPedidos: async (orderIds) =>
        (
          await prisma.order.findMany({
            where: { id: { in: orderIds } },
            select: { id: true, status: true, mpPaymentId: true, totalCents: true },
          })
        ).map((p) => ({ ...p, status: String(p.status) })),
      leerPago: (paymentId) => leerPagoConToken(paymentId, params.accessTokenOverride),
      finalizarPedido: (orderId, paymentId, grupo) =>
        finalizeAlbumOrderMercadoPagoApproved(orderId, paymentId, {
          accessTokenOverride: params.accessTokenOverride,
          grupo: { id: grupo.id, orderIds: grupo.orderIds },
          omitirComprobantePack: true,
        }),
      marcarGrupoPagado: async (grupoId, paymentId) => {
        await prisma.orderPaymentGroup.updateMany({
          where: { id: grupoId, status: { in: ["PENDING", "FAILED"] } },
          data: { status: "PAID", mpPaymentId: paymentId, paidAt: new Date() },
        });
      },
      encolarComprobante: encolarComprobanteGrupo,
    },
    { grupoId: params.grupoId, paymentId: params.paymentId },
  );
  if (!r.ok) console.error(`${LOG} no_finalizado`, { ...params, accessTokenOverride: undefined, error: r.error, detalle: r.detalle });
  else if (r.fallidos.length > 0 || r.duplicados.length > 0) {
    console.error(`${LOG} finalizado_con_pendientes`, {
      grupoId: params.grupoId,
      paymentId: params.paymentId,
      fallidos: r.fallidos,
      duplicados: r.duplicados,
    });
  }
  return r;
}

export async function revertirGrupoPreventa(params: {
  grupoId: string;
  paymentId: string;
  mpStatus: string;
  statusDetail?: string;
}): Promise<{ ok: boolean; revertidos: number[]; error?: string }> {
  return revertirGrupoConDeps(
    {
      cargarGrupo: cargarGrupoPreventa,
      revertirPedido: (p) => reverseAlbumOrderMercadoPagoIfWasPaid(p),
      marcarFallidoSiPendiente: async (orderId) => {
        const r = await prisma.order.updateMany({
          where: { id: orderId, status: OrderStatus.PENDING },
          data: { status: OrderStatus.FAILED },
        });
        if (r.count > 0) {
          const o = await prisma.order.findUnique({ where: { id: orderId }, select: { albumId: true } });
          await registerAuditEvent({
            targetOrderType: "ALBUM_ORDER",
            targetOrderId: orderId,
            targetAlbumId: o?.albumId,
            eventType: "PAYMENT_REJECTED",
          });
        }
      },
      marcarGrupo: async (grupoId, status) => {
        await prisma.orderPaymentGroup.update({ where: { id: grupoId }, data: { status } });
      },
    },
    params,
  );
}

/** Aviso de Mercado Pago (webhook) de un pago de grupo de preventa. */
export async function procesarAvisoGrupoPreventa(params: {
  paymentId: string;
  accessTokenOverride?: string;
}) {
  return procesarAvisoGrupoConDeps(
    {
      leerPago: (paymentId) => leerPagoConToken(paymentId, params.accessTokenOverride),
      yaProcesado: async (paymentId, pago, grupoId) => {
        const grupo = await cargarGrupoPreventa(grupoId);
        const r = await ensureWebhookIdempotency(paymentId, {
          orderId: grupo ? Math.min(...grupo.orderIds) : undefined,
          orderType: "ALBUM_ORDER",
          status: pago.status,
          externalRef: pago.externalReference ?? undefined,
        });
        return r.alreadyProcessed;
      },
      finalizar: (grupoId, paymentId) =>
        finalizarGrupoPreventa({ grupoId, paymentId, accessTokenOverride: params.accessTokenOverride }),
      revertir: revertirGrupoPreventa,
    },
    { paymentId: params.paymentId },
  );
}

async function enlaceDelPack(orderId: number): Promise<string | null> {
  try {
    const t =
      (await ensurePackAccessTokenForOrder(orderId)) ??
      (await createPackAccessTokenForOrder(orderId, { revokeExisting: false }));
    return t?.token ? `${appUrl()}${rutaDelPackConCodigo(t.token)}` : null;
  } catch (err: unknown) {
    console.error(`${LOG} no se pudo generar el enlace del pack`, { orderId, err: String(err) });
    return null;
  }
}

async function packsDelGrupo(orderIds: number[]): Promise<PackDelComprobanteGrupo[]> {
  const pedidos = await prisma.order.findMany({
    where: { id: { in: orderIds }, origin: OrderOrigin.PREVENTA_PACK },
    select: { id: true, totalCents: true, preventaPackSnapshotJson: true, preCompraPaymentRef: true },
  });
  const out: PackDelComprobanteGrupo[] = [];
  for (const p of pedidos) {
    const snap = (p.preventaPackSnapshotJson ?? {}) as Record<string, unknown>;
    let quantity = 1;
    const pcId = Number(p.preCompraPaymentRef);
    if (Number.isInteger(pcId) && pcId > 0) {
      const n = await prisma.preCompraOrderItem.count({ where: { orderId: pcId } }).catch(() => 0);
      if (n > 0) quantity = n;
    }
    out.push({
      orderId: p.id,
      packName: typeof snap.packName === "string" ? snap.packName : null,
      quantity,
      totalArs: Math.max(0, Math.round(p.totalCents)),
      packAccessUrl: await enlaceDelPack(p.id),
    });
  }
  return out.sort((a, b) => a.orderId - b.orderId);
}

/** Un solo comprobante para la familia con todos los packs y el enlace de cada uno. */
export async function encolarComprobanteGrupo(grupoId: string, paymentId: string): Promise<void> {
  try {
    const row = await prisma.orderPaymentGroup.findUnique({ where: { id: grupoId } });
    if (!row) return;
    const primero = await prisma.order.findFirst({
      where: { id: { in: row.orderIds } },
      orderBy: { id: "asc" },
      select: { buyerName: true, buyerEmail: true, createdAt: true, album: { select: { title: true } } },
    });
    if (!primero?.buyerEmail) return;
    const packs = await packsDelGrupo(row.orderIds);
    const { subject, text, html } = armarComprobanteGrupo({
      buyerName: primero.buyerName,
      buyerEmail: primero.buyerEmail,
      albumTitle: primero.album?.title ?? null,
      purchasedAt: primero.createdAt,
      mpPaymentId: paymentId,
      recoverUrl: `${appUrl()}/cliente/recuperar-pack`,
      packs,
    });
    await queueEmail({
      to: primero.buyerEmail,
      subject,
      body: text,
      htmlBody: html,
      idempotencyKey: `preventa_grupo_access_${grupoId}`,
    });
  } catch (err: unknown) {
    console.error(`${LOG} no se pudo encolar el comprobante`, { grupoId, err: String(err) });
  }
}

/** Para la pantalla de pago exitoso: cada pack del grupo con su enlace (ruta relativa). */
export async function packsDelGrupoParaPagoExitoso(
  grupoId: string,
): Promise<Array<{ orderId: number; packName: string; packAccessUrl: string | null }>> {
  try {
    const grupo = await cargarGrupoPreventa(grupoId);
    if (!grupo) return [];
    const pedidos = await prisma.order.findMany({
      where: { id: { in: grupo.orderIds }, status: OrderStatus.PAID },
      select: { id: true, preventaPackSnapshotJson: true },
      orderBy: { id: "asc" },
    });
    const out: Array<{ orderId: number; packName: string; packAccessUrl: string | null }> = [];
    for (const p of pedidos) {
      const snap = (p.preventaPackSnapshotJson ?? {}) as Record<string, unknown>;
      let ruta: string | null = null;
      try {
        const t = await createPackAccessTokenForOrder(p.id, { revokeExisting: false });
        ruta = t?.token ? rutaDelPackConCodigo(t.token) : null;
      } catch {
        ruta = null;
      }
      out.push({
        orderId: p.id,
        packName: (typeof snap.packName === "string" && snap.packName.trim()) || "Pack",
        packAccessUrl: ruta,
      });
    }
    return out;
  } catch (err: unknown) {
    console.error(`${LOG} no se pudieron leer los packs del grupo`, { grupoId, err: String(err) });
    return [];
  }
}
