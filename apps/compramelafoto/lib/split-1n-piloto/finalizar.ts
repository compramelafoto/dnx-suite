import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDigitalDelivery } from "@/lib/digital-delivery";
import { registerAuditEvent } from "@/lib/antifraud/audit";
import { createReferralEarningsForPaidSale } from "@/lib/referral/create-referral-earnings-for-paid-sale";
import { runAlbumOrderPaidSideEffects } from "@/lib/mercadopago/finalize-album-order-mp-approved";
import { ensureEventOrganizerCommissionSnapshotForPaidOrder } from "@/lib/event-organizer-commission-snapshot";
import { resolvePilotoConfig } from "./config";
import { decidirFinalizacion, pedidoIdDesdeReferencia } from "./decidir";
import { crearClientesPiloto, leerOrdenMp } from "./mp";
import { cargarPedidoPiloto, type PedidoPiloto } from "./pedido";
import { leerMarcaPiloto, marcarSnapshotPiloto, type MarcaPiloto } from "./snapshot";

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
  if (decision === "ya_pagado") {
    // Las comisiones se vuelven a asegurar (es idempotente): si una escritura falló al
    // confirmar, un aviso posterior la completa y nadie queda con un saldo que ya cobró.
    if (order.status === "PAID" && marca.estado === "PAGADO") {
      await registrarComisiones({
        order,
        marca,
        feePesos,
        paymentRef: order.mpPaymentId ?? mp.paymentId ?? mp.id,
      });
    }
    return { ok: true, resultado: "ya_pagado" };
  }
  if (decision !== "aplicar") return { ok: false, error: decision };

  const paymentRef = mp.paymentId ?? mp.id;

  // Como Checkout Pro: la entrega se prepara antes de marcar el pedido pagado. Si falla acá,
  // el pedido sigue sin pagar y el próximo intento (página, aviso o recarga) lo retoma.
  await ensureDigitalDelivery(order.id);

  const aplicado = await confirmarPedidoPagado({
    order,
    marca,
    feePesos,
    paymentRef,
    providerOrderId: mp.id,
    externalReference: mp.externalReference,
    snapshotPagado: marcarSnapshotPiloto(order.pricingSnapshot, { estado: "PAGADO", providerOrderId: mp.id }),
    canal: "split-1n-piloto",
  });
  return { ok: true, resultado: aplicado ? "aplicado" : "ya_pagado" };
}

/**
 * Pasa a pagado un pedido cobrado por Split 1:N (la entrega ya tiene que estar preparada) y
 * corre sus efectos: auditoría, comisiones, avisos y registro del pago. La escritura está
 * condicionada al estado, así sólo un llamado (página, aviso o visita) dispara los efectos.
 * Devuelve false si otro llamado ya lo había confirmado.
 *
 * La usan el piloto de un álbum y el carrito de evento (un llamado por pedido del grupo).
 */
export async function confirmarPedidoPagado(params: {
  order: PedidoPiloto["order"];
  /** Quiénes cobraron por el split y su reparto, para las comisiones. */
  marca: MarcaPiloto;
  feePesos: number;
  paymentRef: string;
  providerOrderId: string;
  externalReference: string | null;
  /** `pricingSnapshot` final del pedido, con su marca en `PAGADO`. */
  snapshotPagado: Record<string, unknown>;
  canal: string;
  /** El carrito de evento manda un solo comprobante por grupo en vez de uno por pedido. */
  omitirComprobanteComprador?: boolean;
}): Promise<boolean> {
  const { order, marca, feePesos, paymentRef } = params;
  const actualizado = await prisma.order.updateMany({
    where: { id: order.id, status: { in: ["PENDING", "FAILED"] } },
    data: {
      status: "PAID",
      mpPaymentId: paymentRef,
      platformCommissionCents: feePesos,
      pricingSnapshot: params.snapshotPagado as Prisma.InputJsonValue,
    },
  });
  if (actualizado.count !== 1) return false;

  // Desde acá el pedido está pagado y no hay vuelta atrás: cada efecto va por separado para
  // que uno que falle no se lleve puestos a los demás.
  for (const eventType of ["PAYMENT_APPROVED", "CUSTOMER_DATA_RELEASED", "ORDER_ITEMS_RELEASED"] as const) {
    await efecto(order.id, `auditoria_${eventType}`, () =>
      registerAuditEvent({
        targetOrderType: "ALBUM_ORDER",
        targetOrderId: order.id,
        targetAlbumId: order.albumId,
        eventType,
        ...(eventType === "PAYMENT_APPROVED"
          ? { metadata: { canal: params.canal, providerOrderId: params.providerOrderId } }
          : {}),
      }),
    );
  }

  await registrarComisiones({ order, marca, feePesos, paymentRef });

  await efecto(order.id, "avisos", () =>
    runAlbumOrderPaidSideEffects({
      orderId: order.id,
      origin: order.origin,
      items: order.items,
      paymentRef,
      ...(params.omitirComprobanteComprador ? { omitirComprobanteComprador: true } : {}),
    }),
  );

  await efecto(order.id, "webhook_event", () =>
    prisma.webhookEvent.create({
      data: {
        paymentId: paymentRef,
        status: "approved",
        orderId: order.id,
        orderType: "ALBUM_ORDER",
        externalRef: params.externalReference ?? undefined,
      },
    }),
  );

  console.info("[split-1n-piloto] pedido_pagado", {
    orderId: order.id,
    providerOrderId: params.providerOrderId,
    canal: params.canal,
  });
  return true;
}

async function efecto(orderId: number, nombre: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err: unknown) {
    console.error("[split-1n-piloto] efecto_fallido", {
      orderId,
      efecto: nombre,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Comisiones de referidores y organizador de un pedido del piloto ya pagado. Idempotente:
 * se llama al confirmar y en cada aviso posterior, para completar lo que haya fallado.
 */
export async function registrarComisiones(params: {
  order: PedidoPiloto["order"];
  marca: MarcaPiloto;
  feePesos: number;
  paymentRef: string;
}) {
  const { order, marca, feePesos, paymentRef } = params;
  const saleRef = `ALBUM_ORDER:${order.id}`;
  const photographerUserId = order.album?.userId;
  if (photographerUserId) {
    await efecto(order.id, "comision_referidor", async () => {
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
        const registrada =
          marcadas.count === 1 ||
          (marcadas.count === 0 &&
            (await prisma.referralEarning.count({
              where: { saleRef, referralProgram: programa, attribution: { referrerUserId: referidorUserId } },
            })) === 1);
        if (!registrada) {
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

  // Comisión del organizador: sólo si la cobró por el split, y nace como cobrada directo en
  // una sola escritura. Si el organizador no cobró por el split no se registra nada: el dinero
  // ya lo recibió el fotógrafo y no hay saldo que retenerle a nadie.
  const organizadorUserId = marca.organizadorUserId ?? null;
  if (order.album?.eventId != null && organizadorUserId != null) {
    await efecto(order.id, "comision_organizador", async () => {
      await ensureEventOrganizerCommissionSnapshotForPaidOrder(order.id, {
        paymentApprovedAt: new Date(),
        cobradoDirectoPorOrganizadorUserId: organizadorUserId,
      });
      const fila = await prisma.eventOrganizerCommission.findUnique({
        where: { orderId: order.id },
        select: { organizerUserId: true, organizerCommissionAmount: true, payoutMode: true },
      });
      const registrado = fila ? Number(fila.organizerCommissionAmount) : null;
      if (
        !fila ||
        fila.organizerUserId !== organizadorUserId ||
        fila.payoutMode !== "ORGANIZER_AS_COLLECTOR" ||
        registrado !== (marca.reparto?.organizador ?? null)
      ) {
        console.error("[split-1n-piloto] comision_organizador_no_coincide", {
          orderId: order.id,
          organizadorUserId,
          fila,
          cobrado: marca.reparto?.organizador ?? null,
        });
      }
    });
  }
}
