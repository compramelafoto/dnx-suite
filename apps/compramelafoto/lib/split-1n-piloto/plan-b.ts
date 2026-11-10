"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureAlbumOrderMpPreference } from "@/lib/mercadopago/album-order-mp-preference";
import { resolvePilotoConfig } from "./config";
import { decidirPlanB } from "./plan-b-decidir";
import { intentarCheckoutSplit } from "./plan-b-split-real";
import { leerMarcaPiloto, marcarSnapshotPiloto } from "./snapshot";

export type PlanBResult = { ok: true; initPoint: string } | { ok: false; mensaje: string };

const MENSAJES = {
  cobro_en_curso:
    "Ya hay un pago con tarjeta en curso para esta compra. Esperá unos minutos y recargá la página: no pagues de nuevo.",
  ya_pagado: "Esta compra ya está pagada.",
  no_disponible: "El pago con Mercado Pago no está disponible para esta compra.",
  no_es_piloto: "No encontramos esta compra. Volvé al álbum para empezar de nuevo.",
  error: "No pudimos abrir Mercado Pago. Probá de nuevo en unos minutos o pagá con tarjeta.",
} as const;

/**
 * Plan B de la página de pago: el comprador prefiere «Pagar con Mercado Pago» (o la tarjeta
 * falló). Con `DNX_CLF_SPLIT_1N_PLAN_B_SPLIT_ENABLED` y un pedido elegible, cobra con reparto
 * (`plan-b-split.ts`); si no, el mismo pedido pasa al cobro de siempre (Checkout Pro 1:1), sin
 * perder la venta.
 *
 * Contra el cobro doble: el pase es una escritura condicionada a que la marca siga en
 * `PENDIENTE`, la misma condición que exige el cobro con tarjeta para reservar. Si los dos
 * llegan a la vez, sólo uno gana. Después del pase la tarjeta ya no cobra este pedido.
 * La marca no se borra: queda `CHECKOUT_PRO`, con la historia de los intentos.
 */
export async function pasarPedidoACheckoutPro(input: { pedidoId: number }): Promise<PlanBResult> {
  const pedidoId = Number(input.pedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return { ok: false, mensaje: MENSAJES.no_es_piloto };

  // Con la tarjeta disponible, el plan B depende de su interruptor; con el piloto apagado es la
  // única salida de los pedidos que quedaron con la marca.
  // Un pedido que ya eligió Mercado Pago (con o sin reparto) siempre puede continuar.
  const config = resolvePilotoConfig();
  const previo = await prisma.order.findUnique({ where: { id: pedidoId }, select: { pricingSnapshot: true } });
  const estadoPrevio = previo ? leerMarcaPiloto(previo.pricingSnapshot)?.estado : null;
  if (
    config.enabled &&
    config.publicKey &&
    !config.planB &&
    estadoPrevio !== "CHECKOUT_PRO" &&
    estadoPrevio !== "CHECKOUT_SPLIT"
  ) {
    return { ok: false, mensaje: MENSAJES.no_disponible };
  }

  // Primero, el Checkout Pro con reparto (si está encendido, o si ya hay una orden con reparto).
  // Si no corresponde o no se pudo crear, sigue el de siempre.
  if (config.planBSplit || estadoPrevio === "CHECKOUT_SPLIT") {
    try {
      const split = await intentarCheckoutSplit(pedidoId);
      if (split.tipo === "url") return { ok: true, initPoint: split.url };
      if (split.tipo === "fin") return { ok: false, mensaje: split.mensaje };
    } catch (err: unknown) {
      console.error("[split-1n-piloto] checkout_split_fallido", {
        pedidoId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { ok: false, mensaje: MENSAJES.error };
    }
  }

  const order = await prisma.order.findUnique({
    where: { id: pedidoId },
    select: { id: true, status: true, pricingSnapshot: true },
  });
  const marca = order ? leerMarcaPiloto(order.pricingSnapshot) : null;
  const decision = decidirPlanB({ estadoPedido: order?.status ?? "", marca });
  if (!order || !marca || decision === "no_es_piloto") return { ok: false, mensaje: MENSAJES.no_es_piloto };
  if (decision === "ya_pagado" || decision === "cobro_en_curso") {
    return { ok: false, mensaje: MENSAJES[decision] };
  }
  if (decision === "split_en_curso") return { ok: false, mensaje: MENSAJES.cobro_en_curso };

  let pasadoAhora = false;
  if (decision === "pasar") {
    // La condición es la marca entera tal como se leyó (no sólo el estado): si en el medio
    // terminó otro intento con tarjeta, no se pisan su intento ni su orden de Mercado Pago.
    const pasado = await prisma.order.updateMany({
      where: {
        id: pedidoId,
        status: { in: ["PENDING", "FAILED"] },
        pricingSnapshot: { path: ["split1nPiloto"], equals: marca as unknown as Prisma.InputJsonValue },
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
      if (otra === "pasar") return { ok: false, mensaje: MENSAJES.error };
      if (otra !== "ya_elegido") {
        return { ok: false, mensaje: otra === "ya_pagado" ? MENSAJES.ya_pagado : MENSAJES.cobro_en_curso };
      }
    } else {
      pasadoAhora = true;
      console.info("[split-1n-piloto] plan_b_checkout_pro", { pedidoId });
    }
  }

  let pref: Awaited<ReturnType<typeof ensureAlbumOrderMpPreference>> | null = null;
  try {
    pref = await ensureAlbumOrderMpPreference(pedidoId);
  } catch (err: unknown) {
    console.error("[split-1n-piloto] plan_b_preferencia_fallida", {
      pedidoId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  if (pref?.ok) return { ok: true, initPoint: pref.initPoint };
  if (pref && !pref.ok) {
    console.error("[split-1n-piloto] plan_b_preferencia_fallida", { pedidoId, code: pref.code, error: pref.error });
  }
  if (pasadoAhora) await volverAPendiente(pedidoId);
  return { ok: false, mensaje: MENSAJES.error };
}

/**
 * Si Checkout Pro no se pudo armar (p. ej. el vínculo del fotógrafo con Mercado Pago venció),
 * el pedido vuelve a la tarjeta para no perder la venta. Sólo si no existe ningún enlace de
 * Checkout Pro (`mpPreferenceId` vacío): sin enlace, nadie pudo pagar por ese lado.
 */
async function volverAPendiente(pedidoId: number): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: pedidoId },
      select: { pricingSnapshot: true, mpPreferenceId: true, status: true },
    });
    if (!order || order.mpPreferenceId || leerMarcaPiloto(order.pricingSnapshot)?.estado !== "CHECKOUT_PRO") return;
    await prisma.order.updateMany({
      where: {
        id: pedidoId,
        status: { in: ["PENDING", "FAILED"] },
        mpPreferenceId: null,
        pricingSnapshot: { path: ["split1nPiloto", "estado"], equals: "CHECKOUT_PRO" },
      },
      data: {
        pricingSnapshot: marcarSnapshotPiloto(order.pricingSnapshot, {
          estado: "PENDIENTE",
        }) as Prisma.InputJsonValue,
      },
    });
    console.info("[split-1n-piloto] plan_b_vuelve_a_tarjeta", { pedidoId });
  } catch (err: unknown) {
    console.error("[split-1n-piloto] plan_b_no_vuelve_a_tarjeta", {
      pedidoId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
