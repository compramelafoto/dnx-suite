"use server";

import type { Prisma } from "@prisma/client";
import type { CardPaymentSubmission } from "@repo/payments/frontend";
import { sanitizeCardPaymentSubmissionForLog } from "@repo/payments/frontend";
import { singleIntangibleItem, toOrdersCardPaymentMethod } from "@repo/payments/mercado-pago";
import { prisma } from "@/lib/prisma";
import { cargarConfigPiloto } from "../split-1n-piloto/receptores-clf";
import { clasificarErrorCobro } from "../split-1n-piloto/intento";
import { mensajeRechazo } from "../split-1n-piloto/mensajes";
import { leerOrdenMp } from "../split-1n-piloto/mp";
import type { PagarPilotoResult } from "../split-1n-piloto/pagar";
import type { EstadoPiloto } from "../split-1n-piloto/snapshot";
import { cargarGrupo, estadoDelGrupo } from "./cargar";
import { carritoActivoParaEvento, resolveCarritoConfig } from "./config";
import { finalizarGrupo } from "./finalizar-grupo";
import {
  claveIntentoGrupo,
  marcarSnapshotGrupo,
  referenciaGrupo,
  urlPagoGrupo,
  type MarcaGrupo,
} from "./marca";
import { mensajeGrupo } from "./mensajes-grupo";
import { prepararPagoGrupo } from "./preparar-grupo";

function falla(codigo: string, mensaje?: string): PagarPilotoResult {
  return { ok: false, codigo, mensaje: mensaje ?? mensajeGrupo(codigo) };
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

  console.info(
    JSON.stringify({
      event: "CLF_SPLIT_1N_CARRITO_EVENTO",
      phase: "submit",
      grupoId,
      pedidos: grupo.pedidos.map((p) => p.order.id),
      ...sanitizeCardPaymentSubmissionForLog(input.cardPayment),
    }),
  );

  // La elegibilidad, los consentimientos y el reparto se vuelven a mirar: entre el carrito y el
  // pago pudo cambiar algo.
  const preparado = await prepararPagoGrupo({ grupo, piloto, carrito, estadoGrupo: estadoDelGrupo(grupo.pedidos) });
  if (!preparado.ok) return falla(preparado.codigo);
  const { clientes, cobro, payerEmail } = preparado;

  // Reserva de todo el grupo: sólo un intento puede pasar de PENDIENTE a COBRANDO, y o pasan
  // todos los pedidos o ninguno.
  const intento = Math.max(0, ...grupo.pedidos.map((p) => p.marca.intento ?? 0)) + 1;
  const reservados: Reservado[] = grupo.pedidos.map((p) => ({
    id: p.order.id,
    snapshot: marcarSnapshotGrupo(sinOrdenAnterior(p.order.pricingSnapshot), {
      estado: "COBRANDO",
      intento,
      cobro: preparado.cobroDelPedido(p),
    }),
  }));
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
