"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureAlbumOrderMpPreference } from "@/lib/mercadopago/album-order-mp-preference";
import { decidirPlanB } from "./plan-b-decidir";
import { leerMarcaPiloto, marcarSnapshotPiloto } from "./snapshot";

export type PlanBResult = { ok: true; initPoint: string } | { ok: false; mensaje: string };

const MENSAJES = {
  cobro_en_curso:
    "Ya hay un pago con tarjeta en curso para esta compra. Esperá unos minutos y recargá la página: no pagues de nuevo.",
  ya_pagado: "Esta compra ya está pagada.",
  no_es_piloto: "No encontramos esta compra. Volvé al álbum para empezar de nuevo.",
  error: "No pudimos abrir Mercado Pago. Probá de nuevo en unos minutos.",
} as const;

/**
 * Plan B de la página de pago: el comprador prefiere «Pagar con Mercado Pago» (o la tarjeta
 * falló). El mismo pedido pasa al cobro de siempre (Checkout Pro), sin perder la venta.
 *
 * Contra el cobro doble: el pase es una escritura condicionada a que la marca siga en
 * `PENDIENTE`, la misma condición que exige el cobro con tarjeta para reservar. Si los dos
 * llegan a la vez, sólo uno gana. Después del pase la tarjeta ya no cobra este pedido.
 * La marca no se borra: queda `CHECKOUT_PRO`, con la historia de los intentos.
 */
export async function pasarPedidoACheckoutPro(input: { pedidoId: number }): Promise<PlanBResult> {
  const pedidoId = Number(input.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return { ok: false, mensaje: MENSAJES.no_es_piloto };

  const order = await prisma.order.findUnique({
    where: { id: pedidoId },
    select: { id: true, status: true, pricingSnapshot: true },
  });
  const decision = decidirPlanB({
    estadoPedido: order?.status ?? "",
    marca: order ? leerMarcaPiloto(order.pricingSnapshot) : null,
  });
  if (!order || decision === "no_es_piloto") return { ok: false, mensaje: MENSAJES.no_es_piloto };
  if (decision === "ya_pagado" || decision === "cobro_en_curso") {
    return { ok: false, mensaje: MENSAJES[decision] };
  }

  if (decision === "pasar") {
    const pasado = await prisma.order.updateMany({
      where: {
        id: pedidoId,
        status: { in: ["PENDING", "FAILED"] },
        pricingSnapshot: { path: ["split1nPiloto", "estado"], equals: "PENDIENTE" },
      },
      data: {
        pricingSnapshot: marcarSnapshotPiloto(order.pricingSnapshot, {
          estado: "CHECKOUT_PRO",
        }) as Prisma.InputJsonValue,
      },
    });
    if (pasado.count !== 1) {
      // Otra pestaña ganó: puede ser un cobro con tarjeta o el mismo plan B.
      const ahora = await prisma.order.findUnique({
        where: { id: pedidoId },
        select: { status: true, pricingSnapshot: true },
      });
      const otra = decidirPlanB({
        estadoPedido: ahora?.status ?? "",
        marca: ahora ? leerMarcaPiloto(ahora.pricingSnapshot) : null,
      });
      if (otra !== "ya_elegido") {
        return { ok: false, mensaje: otra === "ya_pagado" ? MENSAJES.ya_pagado : MENSAJES.cobro_en_curso };
      }
    }
    console.info("[split-1n-piloto] plan_b_checkout_pro", { pedidoId });
  }

  try {
    const pref = await ensureAlbumOrderMpPreference(pedidoId);
    if (!pref.ok) {
      console.error("[split-1n-piloto] plan_b_preferencia_fallida", { pedidoId, code: pref.code, error: pref.error });
      return { ok: false, mensaje: pref.error || MENSAJES.error };
    }
    return { ok: true, initPoint: pref.initPoint };
  } catch (err: unknown) {
    console.error("[split-1n-piloto] plan_b_preferencia_fallida", {
      pedidoId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, mensaje: MENSAJES.error };
  }
}
