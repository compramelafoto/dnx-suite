import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDigitalDelivery } from "@/lib/digital-delivery";
import { registerAuditEvent } from "@/lib/antifraud/audit";
import { createReferralEarningsForPaidSale } from "@/lib/referral/create-referral-earnings-for-paid-sale";
import { runAlbumOrderPaidSideEffects } from "@/lib/mercadopago/finalize-album-order-mp-approved";
import { ensureEventOrganizerCommissionSnapshotForPaidOrder } from "@/lib/event-organizer-commission-snapshot";
import { organizerDirectMpCollectionCommissionFields } from "@/lib/event-organizer-commission-ledger";
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

  // Como Checkout Pro: la entrega se prepara antes de marcar el pedido pagado. Si falla acá,
  // el pedido sigue sin pagar y el próximo intento (página, aviso o recarga) lo retoma.
  await ensureDigitalDelivery(order.id);

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

  // Desde acá el pedido está pagado y no hay vuelta atrás: cada efecto va por separado para
  // que uno que falle no se lleve puestos a los demás.
  const efecto = async (nombre: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err: unknown) {
      console.error("[split-1n-piloto] efecto_fallido", {
        orderId: order.id,
        efecto: nombre,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  for (const eventType of ["PAYMENT_APPROVED", "CUSTOMER_DATA_RELEASED", "ORDER_ITEMS_RELEASED"] as const) {
    await efecto(`auditoria_${eventType}`, () =>
      registerAuditEvent({
        targetOrderType: "ALBUM_ORDER",
        targetOrderId: order.id,
        targetAlbumId: order.albumId,
        eventType,
        ...(eventType === "PAYMENT_APPROVED"
          ? { metadata: { canal: "split-1n-piloto", providerOrderId: mp.id } }
          : {}),
      }),
    );
  }

  const saleRef = `ALBUM_ORDER:${order.id}`;
  const photographerUserId = order.album?.userId;
  if (photographerUserId) {
    await efecto("comision_referidor", async () => {
      await createReferralEarningsForPaidSale({
        saleRef,
        orderType: "ALBUM_ORDER",
        orderId: order.id,
        paymentId: paymentRef,
        photographerUserId,
        eventId: order.album?.eventId ?? null,
        grossPlatformFeeCents: feePesos,
        referralFeeDiscountCents: 0,
      });
      // Sólo nacen pagadas las comisiones de los referidores que cobraron por el split.
      // Cualquier otra queda como siempre, para que se le pague por el circuito de referidos.
      const cobradosPorSplit = [
        ["PHOTOGRAPHER_REFERRAL", marca.referidorUserId ?? null],
        ["ORGANIZER_REFERRAL", marca.referidorOrganizadorUserId ?? null],
      ] as const;
      for (const [programa, referidorUserId] of cobradosPorSplit) {
        if (referidorUserId == null) continue;
        const marcadas = await prisma.referralEarning.updateMany({
          where: {
            saleRef,
            paidOutAt: null,
            referralProgram: programa,
            attribution: { referrerUserId: referidorUserId },
          },
          data: { paidOutAt: new Date() },
        });
        if (marcadas.count !== 1) {
          console.warn("[split-1n-piloto] comision_referidor_sin_registro", {
            orderId: order.id,
            programa,
            referidorUserId,
            marcadas: marcadas.count,
          });
        }
      }
    });
  }

  // Comisión del organizador: se registra con el cálculo de siempre y, si la cobró por el
  // split, como cobrada directo. Si quedara retenida, se le volvería a pagar por retiro.
  if (order.album?.eventId != null) {
    await efecto("comision_organizador", async () => {
      const ahora = new Date();
      await ensureEventOrganizerCommissionSnapshotForPaidOrder(order.id, { paymentApprovedAt: ahora });
      const organizadorUserId = marca.organizadorUserId ?? null;
      if (organizadorUserId == null) return;
      const directa = await prisma.eventOrganizerCommission.updateMany({
        where: { orderId: order.id, organizerUserId: organizadorUserId },
        data: organizerDirectMpCollectionCommissionFields(ahora),
      });
      const fila = await prisma.eventOrganizerCommission.findUnique({
        where: { orderId: order.id },
        select: { organizerCommissionAmount: true },
      });
      const registrado = fila ? Number(fila.organizerCommissionAmount) : null;
      if (directa.count !== 1 || registrado !== (marca.reparto?.organizador ?? null)) {
        console.error("[split-1n-piloto] comision_organizador_no_coincide", {
          orderId: order.id,
          organizadorUserId,
          marcadas: directa.count,
          registrado,
          cobrado: marca.reparto?.organizador ?? null,
        });
      }
    });
  }

  await efecto("avisos", () =>
    runAlbumOrderPaidSideEffects({
      orderId: order.id,
      origin: order.origin,
      items: order.items,
      paymentRef,
    }),
  );

  await efecto("webhook_event", () =>
    prisma.webhookEvent.create({
      data: {
        paymentId: paymentRef,
        status: "approved",
        orderId: order.id,
        orderType: "ALBUM_ORDER",
        externalRef: mp.externalReference ?? undefined,
      },
    }),
  );

  console.info("[split-1n-piloto] pedido_pagado", { orderId: order.id, providerOrderId: mp.id });
  return { ok: true, resultado: "aplicado" };
}
