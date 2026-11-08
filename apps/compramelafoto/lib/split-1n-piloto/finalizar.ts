import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDigitalDelivery } from "@/lib/digital-delivery";
import { registerAuditEvent } from "@/lib/antifraud/audit";
import { createReferralEarningsForPaidSale } from "@/lib/referral/create-referral-earnings-for-paid-sale";
import { runAlbumOrderPaidSideEffects } from "@/lib/mercadopago/finalize-album-order-mp-approved";
import { resolvePilotoConfig } from "./config";
import { decidirFinalizacion, pedidoIdDesdeReferencia } from "./decidir";
import { crearClientesPiloto, leerOrdenMp } from "./mp";
import { cargarPedidoPiloto } from "./pedido";
import { leerMarcaPiloto, marcarSnapshotPiloto } from "./snapshot";

export type FinalizarPilotoResult =
  | { ok: true; resultado: "aplicado" | "ya_pagado" }
  | { ok: false; error: string };

/**
 * Confirma un pedido del piloto cuando su orden de Mercado Pago quedó acreditada.
 *
 * La entrega, los correos y la comisión del referidor salen de las mismas piezas que usa
 * Checkout Pro. La única diferencia: la comisión del referidor nace pagada, porque Mercado
 * Pago ya se la depositó; si quedara pendiente, se la volveríamos a pagar como saldo.
 *
 * La página de pago y el webhook pueden llamar a la vez: el `updateMany` condicionado al
 * estado hace que sólo uno de los dos pase y dispare los efectos.
 */
export async function finalizarPedidoPiloto(params: {
  pedidoId: number;
  providerOrderId: string;
}): Promise<FinalizarPilotoResult> {
  const cargado = await cargarPedidoPiloto(params.pedidoId);
  if (!cargado) return { ok: false, error: "pedido_inexistente" };
  const { order, feePesos } = cargado;
  const marca = leerMarcaPiloto(order.pricingSnapshot);
  if (!marca) return { ok: false, error: "pedido_fuera_de_piloto" };

  const { http } = crearClientesPiloto(resolvePilotoConfig());
  const mp = await leerOrdenMp(http, params.providerOrderId);
  const decision = decidirFinalizacion({
    estadoPedido: order.status,
    mpStatus: mp.status,
    mpStatusDetail: mp.statusDetail,
    refPedidoId: pedidoIdDesdeReferencia(mp.externalReference),
    pedidoId: order.id,
  });
  if (decision === "ya_pagado") return { ok: true, resultado: "ya_pagado" };
  if (decision !== "aplicar") return { ok: false, error: decision };

  const paymentRef = mp.paymentId ?? mp.id;
  const actualizado = await prisma.order.updateMany({
    where: { id: order.id, status: { in: ["PENDING", "FAILED"] } },
    data: {
      status: "PAID",
      mpPaymentId: paymentRef,
      platformCommissionCents: feePesos,
      pricingSnapshot: marcarSnapshotPiloto(order.pricingSnapshot, {
        estado: "PAGADO",
        providerOrderId: mp.id,
      }) as Prisma.InputJsonValue,
    },
  });
  if (actualizado.count !== 1) return { ok: true, resultado: "ya_pagado" };

  await ensureDigitalDelivery(order.id);

  for (const eventType of ["PAYMENT_APPROVED", "CUSTOMER_DATA_RELEASED", "ORDER_ITEMS_RELEASED"] as const) {
    await registerAuditEvent({
      targetOrderType: "ALBUM_ORDER",
      targetOrderId: order.id,
      targetAlbumId: order.albumId,
      eventType,
      ...(eventType === "PAYMENT_APPROVED"
        ? { metadata: { canal: "split-1n-piloto", providerOrderId: mp.id } }
        : {}),
    });
  }

  const saleRef = `ALBUM_ORDER:${order.id}`;
  if (order.album?.userId) {
    await createReferralEarningsForPaidSale({
      saleRef,
      orderType: "ALBUM_ORDER",
      orderId: order.id,
      paymentId: paymentRef,
      photographerUserId: order.album.userId,
      eventId: order.album.eventId ?? null,
      grossPlatformFeeCents: feePesos,
      referralFeeDiscountCents: 0,
    });
    await prisma.referralEarning.updateMany({
      where: { saleRef, paidOutAt: null },
      data: { paidOutAt: new Date() },
    });
  }

  await runAlbumOrderPaidSideEffects({
    orderId: order.id,
    origin: order.origin,
    items: order.items,
    paymentRef,
  });

  try {
    await prisma.webhookEvent.create({
      data: {
        paymentId: paymentRef,
        status: "approved",
        orderId: order.id,
        orderType: "ALBUM_ORDER",
        externalRef: mp.externalReference ?? undefined,
      },
    });
  } catch (err: unknown) {
    console.error("[split-1n-piloto] webhook_event_no_registrado", { orderId: order.id, err });
  }

  console.info("[split-1n-piloto] pedido_pagado", { orderId: order.id, providerOrderId: mp.id });
  return { ok: true, resultado: "aplicado" };
}
