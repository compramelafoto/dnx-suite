"use server";

import { OrderOrigin, type Prisma } from "@prisma/client";
import type { CardPaymentSubmission } from "@repo/payments/frontend";
import { sanitizeCardPaymentSubmissionForLog } from "@repo/payments/frontend";
import {
  assertLiveCollectorAccount,
  singleIntangibleItem,
  toOrdersCardPaymentMethod,
} from "@repo/payments/mercado-pago";
import { prisma } from "@/lib/prisma";
import { cargarConfigPiloto } from "../split-1n-piloto/receptores-clf";
import { clasificarErrorCobro } from "../split-1n-piloto/intento";
import { mensajeRechazo } from "../split-1n-piloto/mensajes";
import { crearClientesPiloto, leerOrdenMp } from "../split-1n-piloto/mp";
import { buscarOrganizador } from "../split-1n-piloto/organizador";
import type { PagarPilotoResult } from "../split-1n-piloto/pagar";
import { buscarReferidorActivo } from "../split-1n-piloto/referidor";
import type { EstadoPiloto } from "../split-1n-piloto/snapshot";
import { cargarGrupo, estadoDelGrupo, type GrupoCargado } from "./cargar";
import { prepararCobroGrupo } from "./cobro-grupo";
import { carritoActivoParaEvento, resolveCarritoConfig } from "./config";
import { evaluarElegibilidadGrupo } from "./elegibilidad-grupo";
import { finalizarGrupo } from "./finalizar-grupo";
import {
  claveIntentoGrupo,
  marcarSnapshotGrupo,
  referenciaGrupo,
  urlPagoGrupo,
  type MarcaGrupo,
} from "./marca";

const MENSAJES: Record<string, string> = {
  YA_PAGADO: "Esta compra ya está pagada.",
  ORDEN_EN_CURSO:
    "Esta compra ya tiene un pago en curso. Esperá unos minutos y recargá la página: no pagues de nuevo.",
  PAGADOR_ES_RECEPTOR:
    "El correo de la compra es de alguien que cobra parte de esta venta. Usá otro correo.",
  DEMASIADOS_RECEPTORES:
    "Esta compra tiene demasiados fotógrafos para pagarla junta. Volvé al evento para pagar cada álbum por separado.",
  NO_DISPONIBLE:
    "El pago en un solo paso no está disponible para esta compra. Volvé al evento para pagar cada álbum por separado.",
  CONSENTIMIENTO_NO_ACTIVO:
    "Alguno de los fotógrafos no puede cobrar con tarjeta en este momento. Volvé al evento para pagar cada álbum por separado.",
};

function falla(codigo: string, mensaje?: string): PagarPilotoResult {
  return { ok: false, codigo, mensaje: mensaje ?? MENSAJES[codigo] ?? MENSAJES.NO_DISPONIBLE };
}

type Reservado = { id: number; snapshot: Record<string, unknown> };

/**
 * El snapshot sin el `providerOrderId` de un intento anterior: un intento nuevo arranca sin
 * orden, y si su resultado es incierto la conciliación no mira la orden vieja (rechazada).
 */
function sinOrdenAnterior(snapshot: unknown): Record<string, unknown> {
  const base = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? { ...(snapshot as Record<string, unknown>) } : {};
  const marca = base.split1nGrupo;
  if (marca && typeof marca === "object" && !Array.isArray(marca)) {
    const { providerOrderId: _anterior, ...resto } = marca as Record<string, unknown>;
    base.split1nGrupo = resto;
  }
  return base;
}

/** Cambia la marca de todos los pedidos que sigan sin pagar (no pisa un PAGADO del aviso). */
async function guardarMarcaGrupo(
  reservados: Reservado[],
  cambios: Omit<Partial<MarcaGrupo>, "v"> & { estado: EstadoPiloto },
) {
  for (const r of reservados) {
    await prisma.order.updateMany({
      where: { id: r.id, status: { in: ["PENDING", "FAILED"] } },
      data: { pricingSnapshot: marcarSnapshotGrupo(r.snapshot, cambios) as Prisma.InputJsonValue },
    });
  }
}

async function correosClf(userIds: Array<number | null | undefined>): Promise<string[]> {
  const ids = [...new Set(userIds.filter((id): id is number => id != null))];
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { email: true } });
  return users.map((u) => u.email.toLowerCase());
}

/** Los datos de elegibilidad de cada pedido del grupo, vueltos a leer de la base. */
async function evaluarGrupo(grupo: GrupoCargado) {
  const organizador = await buscarOrganizador(grupo.eventId);
  const referidores = new Map<number, number | null>();
  const albumes = [];
  for (const p of grupo.pedidos) {
    const photographerUserId = p.order.album?.userId ?? null;
    let referrerUserId: number | null = null;
    if (photographerUserId != null) {
      referrerUserId = referidores.has(photographerUserId)
        ? referidores.get(photographerUserId)!
        : await buscarReferidorActivo(photographerUserId);
      referidores.set(photographerUserId, referrerUserId);
    }
    albumes.push({
      albumId: p.order.albumId,
      eventId: p.order.album?.eventId ?? null,
      photographerUserId,
      referrerUserId,
      organizador,
      esEscolar: p.order.album?.schoolId != null,
      items: p.order.items,
      tieneVideos: false,
      esCanje: false,
      esPagoSimulado: false,
      origenEstandar: (p.order.origin ?? OrderOrigin.STANDARD_CHECKOUT) === OrderOrigin.STANDARD_CHECKOUT,
      autoresDeFotos: grupo.autoresPorPedido.get(p.order.id) ?? [],
    });
  }
  return { organizador, referidores, albumes };
}

/**
 * Cobra un carrito de evento con la tarjeta del comprador: una sola orden de Mercado Pago que
 * reparte a todos. El monto, los receptores y el reparto los arma el servidor desde los pedidos.
 *
 * Contra el cobro doble, igual que el piloto: antes de llamar a Mercado Pago todos los pedidos
 * se reservan (`COBRANDO`) en una transacción (si uno no pasa, no pasa ninguno), cada intento
 * tiene su clave de idempotencia, y un resultado incierto deja el grupo trabado hasta verificar.
 */
export async function pagarGrupo(input: {
  grupoId: string;
  cardPayment: CardPaymentSubmission;
}): Promise<PagarPilotoResult> {
  const piloto = await cargarConfigPiloto();
  const carrito = resolveCarritoConfig();
  const grupo = await cargarGrupo(input.grupoId);
  if (!grupo || !carritoActivoParaEvento(carrito, piloto, grupo.eventId)) return falla("NO_DISPONIBLE");
  const grupoId = grupo.grupoId;

  const device = input.cardPayment?.deviceSessionId?.trim() ?? "";
  const token = input.cardPayment?.token?.trim() ?? "";
  if (!device || !token) {
    return falla("FORMULARIO_INCOMPLETO", "Esperá a que cargue el formulario y volvé a intentar.");
  }

  // La elegibilidad se vuelve a mirar: entre el carrito y el pago pudo cambiar algo.
  const { organizador, referidores, albumes } = await evaluarGrupo(grupo);
  const elegibilidad = evaluarElegibilidadGrupo({ piloto, carrito, eventId: grupo.eventId ?? -1, albumes });
  if (!elegibilidad.ok) {
    console.info("[carrito-evento] pago_no_elegible", { grupoId, motivos: elegibilidad.motivos });
    return falla("NO_DISPONIBLE");
  }

  console.info(
    JSON.stringify({
      event: "CLF_SPLIT_1N_CARRITO_EVENTO",
      phase: "submit",
      grupoId,
      pedidos: grupo.pedidos.map((p) => p.order.id),
      ...sanitizeCardPaymentSubmissionForLog(input.cardPayment),
    }),
  );

  const payerEmail = grupo.pedidos[0].order.buyerEmail;
  let clientes: ReturnType<typeof crearClientesPiloto>;
  let cobro: Extract<ReturnType<typeof prepararCobroGrupo>, { ok: true }>;
  try {
    clientes = crearClientesPiloto(piloto);
    const cuenta = await assertLiveCollectorAccount(clientes.http);

    const receptores = new Set<string>();
    for (const r of elegibilidad.receivers.values()) {
      for (const c of [r.fotografo, r.referidor, r.organizador, r.referidorOrganizador]) if (c != null) receptores.add(c);
    }
    const consultas = await Promise.all([...receptores].map((r) => clientes.consents.getConsent(r)));
    if (consultas.some((c) => c?.status !== "ACTIVE")) {
      console.warn("[carrito-evento] consentimiento_no_activo", { grupoId });
      return falla("CONSENTIMIENTO_NO_ACTIVO");
    }
    const correosReceptores = [
      ...consultas.map((c) => (c?.sellerEmail ?? "").toLowerCase()),
      ...(cuenta.email ? [cuenta.email.toLowerCase()] : []),
      ...(await correosClf([
        ...albumes.map((a) => a.photographerUserId),
        ...referidores.values(),
        organizador?.userId,
        organizador?.referrerUserId,
      ])),
    ];

    const preparado = prepararCobroGrupo({
      pedidos: grupo.pedidos.map((p) => ({
        pedidoId: p.order.id,
        estadoPedido: p.order.status,
        totalPesos: p.order.totalCents,
        feePesos: p.feePesos,
        basePesos: p.basePesos,
        porcentajeOrganizador: organizador?.porcentaje ?? 0,
        receivers: elegibilidad.receivers.get(p.order.albumId)!,
      })),
      estadoGrupo: estadoDelGrupo(grupo.pedidos),
      payerEmail,
      correosReceptores,
      maxReceptores: carrito.maxReceptores,
    });
    if (!preparado.ok) return falla(preparado.codigo);
    cobro = preparado;
  } catch (err: unknown) {
    console.error("[carrito-evento] preparacion_fallida", {
      grupoId,
      error: err instanceof Error ? err.message : String(err),
    });
    return falla("NO_DISPONIBLE", "No pudimos procesar el pago. No se te cobró nada; probá de nuevo en unos minutos.");
  }

  // Reserva de todo el grupo: sólo un intento puede pasar de PENDIENTE a COBRANDO, y o pasan
  // todos los pedidos o ninguno.
  const intento = Math.max(0, ...grupo.pedidos.map((p) => p.marca.intento ?? 0)) + 1;
  const reservados: Reservado[] = grupo.pedidos.map((p) => {
    const rcv = elegibilidad.receivers.get(p.order.albumId)!;
    const reparto = cobro.repartos.get(p.order.id)!;
    const photographerUserId = p.order.album?.userId ?? null;
    return {
      id: p.order.id,
      snapshot: marcarSnapshotGrupo(sinOrdenAnterior(p.order.pricingSnapshot), {
        estado: "COBRANDO",
        intento,
        cobro: {
          referidorUserId:
            rcv.referidor != null && photographerUserId != null ? referidores.get(photographerUserId) ?? null : null,
          organizadorUserId: rcv.organizador != null && reparto.organizador > 0 ? organizador?.userId ?? null : null,
          referidorOrganizadorUserId:
            rcv.referidorOrganizador != null && reparto.referidorOrganizador > 0
              ? organizador?.referrerUserId ?? null
              : null,
          reparto,
        },
      }),
    };
  });
  try {
    await prisma.$transaction(async (tx) => {
      for (const r of reservados) {
        const res = await tx.order.updateMany({
          where: {
            id: r.id,
            status: { in: ["PENDING", "FAILED"] },
            AND: [
              { pricingSnapshot: { path: ["split1nGrupo", "grupoId"], equals: grupoId } },
              { pricingSnapshot: { path: ["split1nGrupo", "estado"], equals: "PENDIENTE" } },
            ],
          },
          data: { pricingSnapshot: r.snapshot as Prisma.InputJsonValue },
        });
        if (res.count !== 1) throw new Error(`reserva_rechazada_${r.id}`);
      }
    });
  } catch (err: unknown) {
    console.info("[carrito-evento] reserva_no_obtenida", {
      grupoId,
      error: err instanceof Error ? err.message : String(err),
    });
    return falla("ORDEN_EN_CURSO");
  }

  const externalReference = referenciaGrupo(grupoId);
  // Orders pide la marca y el tipo por separado: `debvisa` del Brick va como visa + débito.
  const medioTarjeta = toOrdersCardPaymentMethod(
    input.cardPayment.paymentMethodId,
    input.cardPayment.paymentTypeId ?? null,
  );
  let providerOrderId: string;
  try {
    const created = await clientes.orders.createSplitOrder({
      environment: "production",
      externalReference,
      total: cobro.total,
      distribution: cobro.distribution,
      idempotencyKey: claveIntentoGrupo(grupoId, intento),
      deviceSessionId: device,
      paymentToken: token,
      paymentMethodId: medioTarjeta.id,
      paymentType: medioTarjeta.type,
      installments: input.cardPayment.installments || 1,
      payerEmail,
      ...(input.cardPayment.payer?.identification
        ? { payerProfile: { identification: input.cardPayment.payer.identification } }
        : {}),
      statementDescriptor: "CLF FOTOS",
      items: [
        singleIntangibleItem({
          title: `Fotos de un evento (${grupo.pedidos.length} álbumes)`,
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
      metadata: { source: "CLF_SPLIT_1N_CARRITO_EVENTO", externalReference },
    });
    providerOrderId = created.providerOrderId;
  } catch (err: unknown) {
    const detalle = err instanceof Error ? err.message : String(err);
    const tipo = clasificarErrorCobro(err);
    console.error("[carrito-evento] crear_orden_fallo", { grupoId, intento, tipo, error: detalle });
    if (tipo === "rechazo") {
      await guardarMarcaGrupo(reservados, { estado: "PENDIENTE" });
      return falla("RECHAZADO", mensajeRechazo(detalle));
    }
    // Incierto: el grupo queda COBRANDO. Lo resuelve el aviso de Mercado Pago o la conciliación.
    return { ok: true, estado: "EN_REVISION" };
  }

  let mp: Awaited<ReturnType<typeof leerOrdenMp>>;
  try {
    mp = await leerOrdenMp(clientes.http, providerOrderId);
  } catch (err: unknown) {
    console.error("[carrito-evento] leer_orden_fallo", { grupoId, providerOrderId, err });
    await guardarMarcaGrupo(reservados, { estado: "COBRANDO", providerOrderId });
    return { ok: true, estado: "EN_REVISION" };
  }

  const acreditada = mp.status === "processed" && mp.statusDetail === "accredited";
  const rechazada = mp.status === "failed" || mp.status === "canceled" || mp.statusDetail === "rejected";
  if (rechazada) {
    console.info("[carrito-evento] pago_rechazado", { grupoId, providerOrderId, status: mp.status, statusDetail: mp.statusDetail });
    await guardarMarcaGrupo(reservados, { estado: "PENDIENTE", providerOrderId });
    return falla("RECHAZADO", mensajeRechazo(mp.statusDetail));
  }
  if (!acreditada) {
    await guardarMarcaGrupo(reservados, { estado: "EN_REVISION", providerOrderId });
    return { ok: true, estado: "EN_REVISION" };
  }

  await guardarMarcaGrupo(reservados, { estado: "ACREDITADA", providerOrderId });
  const fin = await finalizarGrupo({ grupoId, providerOrderId }).catch((err: unknown) => ({
    ok: false as const,
    error: err instanceof Error ? err.message : String(err),
  }));
  if (!fin.ok) {
    // Cobrado pero sin confirmar del todo: lo retoman el aviso o la próxima visita a la página.
    console.error("[carrito-evento] finalizar_fallo", { grupoId, providerOrderId, error: fin.error });
    return { ok: true, estado: "EN_REVISION" };
  }
  return { ok: true, estado: "ACREDITADA", descargaUrl: urlPagoGrupo(grupoId) };
}
