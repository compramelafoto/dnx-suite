"use server";

import { randomUUID } from "node:crypto";
import { OrderOrigin, type Prisma } from "@prisma/client";
import type { CardPaymentSubmission } from "@repo/payments/frontend";
import { sanitizeCardPaymentSubmissionForLog } from "@repo/payments/frontend";
import { assertLiveCollectorAccount, singleIntangibleItem } from "@repo/payments/mercado-pago";
import { prisma } from "@/lib/prisma";
import { getOrderDownloadCenterAccessToken } from "@/lib/digital-download/load-download-center";
import { resolveClientDigitalDownloadLinks } from "@/lib/digital-download/download-center-rollout";
import { resolvePilotoConfig } from "./config";
import { prepararCobro } from "./cobro";
import { referenciaPedido } from "./decidir";
import { evaluarElegibilidadPiloto } from "./elegibilidad";
import { finalizarPedidoPiloto } from "./finalizar";
import { mensajeRechazo } from "./mensajes";
import { crearClientesPiloto, leerOrdenMp } from "./mp";
import { cargarPedidoPiloto } from "./pedido";
import { buscarReferidorActivo } from "./referidor";
import { leerMarcaPiloto, marcarSnapshotPiloto, type MarcaPiloto } from "./snapshot";

export type PagarPilotoResult =
  | { ok: true; estado: "ACREDITADA"; descargaUrl: string | null }
  | { ok: true; estado: "EN_REVISION" }
  | { ok: false; codigo: string; mensaje: string };

const MENSAJES: Record<string, string> = {
  YA_PAGADO: "Esta compra ya está pagada.",
  ORDEN_EN_CURSO: "Esta compra ya tiene un pago en curso. Revisá tu correo en unos minutos.",
  PAGADOR_ES_RECEPTOR:
    "El correo de la compra es de alguien que cobra parte de esta venta. Usá otro correo.",
  NO_DISPONIBLE: "El pago con tarjeta no está disponible para esta compra. Volvé al resumen.",
  CONSENTIMIENTO_NO_ACTIVO:
    "Este álbum no puede cobrar con tarjeta en este momento. Volvé al resumen para pagar con Mercado Pago.",
};

function falla(codigo: string, mensaje?: string): PagarPilotoResult {
  return { ok: false, codigo, mensaje: mensaje ?? MENSAJES[codigo] ?? MENSAJES.NO_DISPONIBLE };
}

async function guardarMarca(pedidoId: number, snapshot: unknown, cambios: Omit<MarcaPiloto, "v">) {
  await prisma.order.update({
    where: { id: pedidoId },
    data: { pricingSnapshot: marcarSnapshotPiloto(snapshot, cambios) as Prisma.InputJsonValue },
  });
}

async function urlDescarga(pedidoId: number, creado: Date): Promise<string | null> {
  try {
    const token = await getOrderDownloadCenterAccessToken(pedidoId);
    if (!token) return null;
    const links = resolveClientDigitalDownloadLinks({
      orderId: pedidoId,
      orderCreatedAt: creado,
      accessToken: token,
      baseUrl: process.env.APP_URL || "https://www.compramelafoto.com",
      context: "split_1n_piloto",
    });
    return links.downloadCenterUrl ?? links.legacyDownloadUrl;
  } catch (err: unknown) {
    console.error("[split-1n-piloto] descarga_no_resuelta", { pedidoId, err });
    return null;
  }
}

/**
 * Cobra un pedido del piloto con la tarjeta que cargó el comprador. El monto, los receptores
 * y el reparto los arma el servidor desde el pedido: del navegador sólo se usa la tarjeta.
 */
export async function pagarPedidoPiloto(input: {
  pedidoId: number;
  cardPayment: CardPaymentSubmission;
}): Promise<PagarPilotoResult> {
  const config = resolvePilotoConfig();
  const cargado = await cargarPedidoPiloto(input.pedidoId);
  if (!cargado) return falla("NO_DISPONIBLE");
  const { order, feePesos } = cargado;
  const marca = leerMarcaPiloto(order.pricingSnapshot);
  if (!marca) return falla("NO_DISPONIBLE");

  const device = input.cardPayment?.deviceSessionId?.trim() ?? "";
  const token = input.cardPayment?.token?.trim() ?? "";
  if (!device || !token) {
    return falla("FORMULARIO_INCOMPLETO", "Esperá a que cargue el formulario y volvé a intentar.");
  }

  // La elegibilidad se vuelve a mirar: entre el resumen y el pago pudo cambiar la lista.
  const photographerUserId = order.album?.userId ?? null;
  const elegibilidad = evaluarElegibilidadPiloto({
    config,
    albumId: order.albumId,
    photographerUserId,
    referrerUserId: photographerUserId != null ? await buscarReferidorActivo(photographerUserId) : null,
    items: order.items,
    tieneVideos: false,
    esCanje: false,
    esPagoSimulado: false,
    origenEstandar: (order.origin ?? OrderOrigin.STANDARD_CHECKOUT) === OrderOrigin.STANDARD_CHECKOUT,
  });
  if (!elegibilidad.ok) {
    console.info("[split-1n-piloto] pago_no_elegible", { pedidoId: order.id, motivo: elegibilidad.motivo });
    return falla("NO_DISPONIBLE");
  }

  console.info(
    JSON.stringify({
      event: "CLF_SPLIT_1N_PILOTO",
      phase: "submit",
      pedidoId: order.id,
      ...sanitizeCardPaymentSubmissionForLog(input.cardPayment),
    }),
  );

  try {
    const { http, consents, orders } = crearClientesPiloto(config);
    const cuenta = await assertLiveCollectorAccount(http);

    const receptores = [elegibilidad.receivers.fotografo, elegibilidad.receivers.referidor].filter(
      (r): r is string => r != null,
    );
    const consultas = await Promise.all(receptores.map((r) => consents.getConsent(r)));
    if (consultas.some((c) => c?.status !== "ACTIVE")) {
      console.warn("[split-1n-piloto] consentimiento_no_activo", { pedidoId: order.id });
      return falla("CONSENTIMIENTO_NO_ACTIVO");
    }
    const correosReceptores = consultas.map((c) => (c?.sellerEmail ?? "").toLowerCase());
    if (cuenta.email) correosReceptores.push(cuenta.email.toLowerCase());

    const cobro = prepararCobro({
      estadoPedido: order.status,
      marca,
      totalPesos: order.totalCents,
      feePesos,
      receivers: elegibilidad.receivers,
      payerEmail: order.buyerEmail,
      correosReceptores,
    });
    if (!cobro.ok) return falla(cobro.codigo);

    const externalReference = referenciaPedido(order.id);
    let providerOrderId: string;
    try {
      const created = await orders.createSplitOrder({
        environment: "production",
        externalReference,
        total: cobro.total,
        distribution: cobro.distribution,
        idempotencyKey: randomUUID(),
        deviceSessionId: device,
        paymentToken: token,
        paymentMethodId: input.cardPayment.paymentMethodId,
        installments: input.cardPayment.installments || 1,
        payerEmail: order.buyerEmail,
        ...(input.cardPayment.payer?.identification
          ? { payerProfile: { identification: input.cardPayment.payer.identification } }
          : {}),
        statementDescriptor: "CLF FOTOS",
        items: [
          singleIntangibleItem({
            title: `Fotos de «${order.album?.title ?? "álbum"}»`,
            total: cobro.total,
            categoryId: "virtual_goods",
          }),
        ],
        partnerReceiverIds: cobro.partnerReceiverIds,
        partnerConsentsByRecipientId: new Map(
          [...cobro.partnerReceiverIds.entries()].map(([recipientId, receiverId]) => [
            recipientId,
            { receiverId, status: "ACTIVE" as const, provider: "mercadopago" as const },
          ]),
        ),
        metadata: { source: "CLF_SPLIT_1N_PILOTO", externalReference },
      });
      providerOrderId = created.providerOrderId;
    } catch (err: unknown) {
      console.error("[split-1n-piloto] orden_rechazada", {
        pedidoId: order.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return falla("RECHAZADO", mensajeRechazo(null));
    }

    const mp = await leerOrdenMp(http, providerOrderId);
    const acreditada = mp.status === "processed" && mp.statusDetail === "accredited";
    const enRevision =
      !acreditada && ["action_required", "processing", "in_process", "pending"].some(
        (s) => mp.status === s || mp.statusDetail === s,
      );

    if (acreditada || enRevision) {
      await guardarMarca(order.id, order.pricingSnapshot, {
        estado: acreditada ? "ACREDITADA" : "EN_REVISION",
        providerOrderId,
        reparto: cobro.reparto,
      });
    }
    if (enRevision) return { ok: true, estado: "EN_REVISION" };
    if (!acreditada) {
      console.info("[split-1n-piloto] pago_rechazado", {
        pedidoId: order.id,
        providerOrderId,
        status: mp.status,
        statusDetail: mp.statusDetail,
      });
      return falla("RECHAZADO", mensajeRechazo(mp.statusDetail));
    }

    const fin = await finalizarPedidoPiloto({ pedidoId: order.id, providerOrderId });
    if (!fin.ok) {
      // Cobrado pero sin confirmar: el webhook lo reintenta. Al comprador no se le pide pagar de nuevo.
      console.error("[split-1n-piloto] finalizar_fallo", { pedidoId: order.id, providerOrderId, error: fin.error });
      return { ok: true, estado: "EN_REVISION" };
    }
    return { ok: true, estado: "ACREDITADA", descargaUrl: await urlDescarga(order.id, order.createdAt) };
  } catch (err: unknown) {
    console.error("[split-1n-piloto] pago_fallido", {
      pedidoId: order.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return falla("NO_DISPONIBLE", "No pudimos procesar el pago. No se te cobró nada; probá de nuevo en unos minutos.");
  }
}
