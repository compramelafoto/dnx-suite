"use server";

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
import { clasificarErrorCobro, claveIntento, siguienteIntento } from "./intento";
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
  ORDEN_EN_CURSO:
    "Esta compra ya tiene un pago en curso. Esperá unos minutos y recargá la página: no pagues de nuevo.",
  PAGADOR_ES_RECEPTOR:
    "El correo de la compra es de alguien que cobra parte de esta venta. Usá otro correo.",
  NO_DISPONIBLE: "El pago con tarjeta no está disponible para esta compra. Volvé al resumen.",
  CONSENTIMIENTO_NO_ACTIVO:
    "Este álbum no puede cobrar con tarjeta en este momento. Volvé al resumen para pagar con Mercado Pago.",
};

function falla(codigo: string, mensaje?: string): PagarPilotoResult {
  return { ok: false, codigo, mensaje: mensaje ?? MENSAJES[codigo] ?? MENSAJES.NO_DISPONIBLE };
}

/**
 * Cambia la marca sólo si el pedido sigue sin pagar: si el aviso de Mercado Pago ya lo
 * confirmó, la marca `PAGADO` no se pisa con un estado anterior.
 */
async function guardarMarca(pedidoId: number, snapshot: unknown, cambios: Omit<MarcaPiloto, "v">) {
  await prisma.order.updateMany({
    where: { id: pedidoId, status: { in: ["PENDING", "FAILED"] } },
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

async function correosClf(userIds: Array<number | null>): Promise<string[]> {
  const ids = userIds.filter((id): id is number => id != null);
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { email: true } });
  return users.map((u) => u.email.toLowerCase());
}

/**
 * Cobra un pedido del piloto con la tarjeta que cargó el comprador. El monto, los receptores
 * y el reparto los arma el servidor desde el pedido: del navegador sólo se usa la tarjeta.
 *
 * Contra el cobro doble: antes de llamar a Mercado Pago el pedido se reserva (`COBRANDO`) con
 * una escritura condicionada, así una segunda pestaña o un doble clic no pasa; y cada intento
 * tiene su clave de idempotencia. Si el resultado es incierto, el pedido queda reservado hasta
 * que la orden se verifique: nunca se le dice al comprador que vuelva a pagar.
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
  const referrerUserId =
    photographerUserId != null ? await buscarReferidorActivo(photographerUserId) : null;
  const elegibilidad = evaluarElegibilidadPiloto({
    config,
    albumId: order.albumId,
    photographerUserId,
    referrerUserId,
    tieneEvento: order.album?.eventId != null,
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

  let clientes: ReturnType<typeof crearClientesPiloto>;
  let cobro: Extract<ReturnType<typeof prepararCobro>, { ok: true }>;
  try {
    clientes = crearClientesPiloto(config);
    const cuenta = await assertLiveCollectorAccount(clientes.http);

    const receptores = [elegibilidad.receivers.fotografo, elegibilidad.receivers.referidor].filter(
      (r): r is string => r != null,
    );
    const consultas = await Promise.all(receptores.map((r) => clientes.consents.getConsent(r)));
    if (consultas.some((c) => c?.status !== "ACTIVE")) {
      console.warn("[split-1n-piloto] consentimiento_no_activo", { pedidoId: order.id });
      return falla("CONSENTIMIENTO_NO_ACTIVO");
    }
    // Quien paga no puede cobrar: se compara con los correos de Mercado Pago y con los de CLF.
    const correosReceptores = [
      ...consultas.map((c) => (c?.sellerEmail ?? "").toLowerCase()),
      ...(cuenta.email ? [cuenta.email.toLowerCase()] : []),
      ...(await correosClf([photographerUserId, referrerUserId])),
    ];

    const preparado = prepararCobro({
      estadoPedido: order.status,
      marca,
      totalPesos: order.totalCents,
      feePesos,
      receivers: elegibilidad.receivers,
      payerEmail: order.buyerEmail,
      correosReceptores,
    });
    if (!preparado.ok) return falla(preparado.codigo);
    cobro = preparado;
  } catch (err: unknown) {
    console.error("[split-1n-piloto] preparacion_fallida", {
      pedidoId: order.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return falla("NO_DISPONIBLE", "No pudimos procesar el pago. No se te cobró nada; probá de nuevo en unos minutos.");
  }

  // Reserva: sólo un intento puede pasar de PENDIENTE a COBRANDO.
  const intento = siguienteIntento(marca);
  const reservado = await prisma.order.updateMany({
    where: {
      id: order.id,
      status: { in: ["PENDING", "FAILED"] },
      pricingSnapshot: { path: ["split1nPiloto", "estado"], equals: "PENDIENTE" },
    },
    data: {
      pricingSnapshot: marcarSnapshotPiloto(order.pricingSnapshot, {
        estado: "COBRANDO",
        intento,
        referidorUserId: elegibilidad.receivers.referidor != null ? referrerUserId : null,
        reparto: cobro.reparto,
      }) as Prisma.InputJsonValue,
    },
  });
  if (reservado.count !== 1) return falla("ORDEN_EN_CURSO");
  const reservada = marcarSnapshotPiloto(order.pricingSnapshot, {
    estado: "COBRANDO",
    intento,
    referidorUserId: elegibilidad.receivers.referidor != null ? referrerUserId : null,
    reparto: cobro.reparto,
  });

  const externalReference = referenciaPedido(order.id);
  let providerOrderId: string;
  try {
    const created = await clientes.orders.createSplitOrder({
      environment: "production",
      externalReference,
      total: cobro.total,
      distribution: cobro.distribution,
      idempotencyKey: claveIntento(order.id, intento),
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
    const detalle = err instanceof Error ? err.message : String(err);
    const tipo = clasificarErrorCobro(err);
    console.error("[split-1n-piloto] crear_orden_fallo", { pedidoId: order.id, intento, tipo, error: detalle });
    if (tipo === "rechazo") {
      await guardarMarca(order.id, reservada, { estado: "PENDIENTE" });
      return falla("RECHAZADO", mensajeRechazo(detalle));
    }
    // Incierto: el pedido queda COBRANDO. Lo resuelve el aviso de Mercado Pago o la conciliación.
    return { ok: true, estado: "EN_REVISION" };
  }

  let mp: Awaited<ReturnType<typeof leerOrdenMp>>;
  try {
    mp = await leerOrdenMp(clientes.http, providerOrderId);
  } catch (err: unknown) {
    console.error("[split-1n-piloto] leer_orden_fallo", { pedidoId: order.id, providerOrderId, err });
    await guardarMarca(order.id, reservada, { estado: "COBRANDO", providerOrderId });
    return { ok: true, estado: "EN_REVISION" };
  }

  const acreditada = mp.status === "processed" && mp.statusDetail === "accredited";
  const rechazada = mp.status === "failed" || mp.status === "canceled" || mp.statusDetail === "rejected";
  if (rechazada) {
    console.info("[split-1n-piloto] pago_rechazado", {
      pedidoId: order.id,
      providerOrderId,
      status: mp.status,
      statusDetail: mp.statusDetail,
    });
    await guardarMarca(order.id, reservada, { estado: "PENDIENTE", providerOrderId });
    return falla("RECHAZADO", mensajeRechazo(mp.statusDetail));
  }
  if (!acreditada) {
    await guardarMarca(order.id, reservada, { estado: "EN_REVISION", providerOrderId });
    return { ok: true, estado: "EN_REVISION" };
  }

  await guardarMarca(order.id, reservada, { estado: "ACREDITADA", providerOrderId });
  const fin = await finalizarPedidoPiloto({ pedidoId: order.id, providerOrderId });
  if (!fin.ok) {
    // Cobrado pero sin confirmar: lo retoman el aviso o la próxima visita a la página.
    console.error("[split-1n-piloto] finalizar_fallo", { pedidoId: order.id, providerOrderId, error: fin.error });
    return { ok: true, estado: "EN_REVISION" };
  }
  return { ok: true, estado: "ACREDITADA", descargaUrl: await urlDescarga(order.id, order.createdAt) };
}
