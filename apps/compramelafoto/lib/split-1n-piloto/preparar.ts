import { OrderOrigin } from "@prisma/client";
import { assertLiveCollectorAccount } from "@repo/payments/mercado-pago";
import { prisma } from "@/lib/prisma";
import { prepararCobro } from "./cobro";
import type { PilotoConfig } from "./config";
import { evaluarElegibilidadPiloto } from "./elegibilidad";
import { crearClientesPiloto } from "./mp";
import { buscarOrganizador } from "./organizador";
import type { PedidoPiloto } from "./pedido";
import { buscarReferidorActivo } from "./referidor";
import type { MarcaPiloto } from "./snapshot";
import { aplicarEstadosConsultados } from "../split-1n-consentimiento/servicio";
import { crearRepositorioConsentimiento } from "../split-1n-consentimiento/repositorio";

export type CobroPedidoPreparado =
  | {
      ok: true;
      clientes: ReturnType<typeof crearClientesPiloto>;
      cobro: Extract<ReturnType<typeof prepararCobro>, { ok: true }>;
      /** Quiénes de CLF cobran por el split: al confirmar, sus comisiones nacen pagadas. */
      quienesCobran: Pick<MarcaPiloto, "referidorUserId" | "organizadorUserId" | "referidorOrganizadorUserId" | "reparto">;
    }
  | { ok: false; codigo: string };

/**
 * Correos de CLF de quienes cobran, incluidas sus otras cuentas de CLF vinculadas a la misma
 * cuenta de Mercado Pago (pedidos 6088/6089: la organizadora compró con su cuenta vieja).
 */
async function correosClf(userIds: Array<number | null>): Promise<string[]> {
  const ids = userIds.filter((id): id is number => id != null);
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { email: true, mpUserId: true },
  });
  const mpIds = [...new Set(users.map((u) => u.mpUserId).filter((m): m is string => !!m))];
  const otras =
    mpIds.length > 0
      ? await prisma.user.findMany({ where: { mpUserId: { in: mpIds } }, select: { email: true } })
      : [];
  return [...new Set([...users, ...otras].map((u) => u.email.toLowerCase()))];
}

/**
 * Todo lo que un cobro del piloto decide antes de escribirle a Mercado Pago, sea con tarjeta o
 * con Checkout Pro con reparto: la elegibilidad (se vuelve a mirar: entre el resumen y el pago
 * pudo cambiar), los consentimientos en vivo, que quien paga no cobre, y el reparto. Así los dos
 * medios reparten con exactamente la misma cuenta.
 *
 * Códigos de falla: NO_DISPONIBLE, CONSENTIMIENTO_NO_ACTIVO, PREPARACION_FALLIDA (error técnico,
 * nada se escribió) y los de `prepararCobro`.
 */
export async function prepararCobroPedidoPiloto(params: {
  config: PilotoConfig;
  cargado: PedidoPiloto;
  marca: MarcaPiloto;
}): Promise<CobroPedidoPreparado> {
  const { config, marca } = params;
  const { order, feePesos, basePesos } = params.cargado;
  // La elegibilidad se vuelve a mirar: entre el resumen y el pago pudo cambiar la lista.
  const photographerUserId = order.album?.userId ?? null;
  const referrerUserId =
    photographerUserId != null ? await buscarReferidorActivo(photographerUserId) : null;
  const organizador = await buscarOrganizador(order.album?.eventId ?? null);
  const elegibilidad = evaluarElegibilidadPiloto({
    config,
    albumId: order.albumId,
    photographerUserId,
    referrerUserId,
    organizador,
    esEscolar: order.album?.schoolId != null,
    items: order.items,
    tieneVideos: false,
    esCanje: false,
    esPagoSimulado: false,
    origenEstandar: (order.origin ?? OrderOrigin.STANDARD_CHECKOUT) === OrderOrigin.STANDARD_CHECKOUT,
  });
  if (!elegibilidad.ok) {
    console.info("[split-1n-piloto] pago_no_elegible", { pedidoId: order.id, motivo: elegibilidad.motivo });
    return { ok: false, codigo: "NO_DISPONIBLE" };
  }

  let clientes: ReturnType<typeof crearClientesPiloto>;
  let cobro: Extract<ReturnType<typeof prepararCobro>, { ok: true }>;
  try {
    clientes = crearClientesPiloto(config);
    const cuenta = await assertLiveCollectorAccount(clientes.http);

    const rcv = elegibilidad.receivers;
    const receptores = [
      ...new Set(
        [rcv.fotografo, rcv.referidor, rcv.organizador, rcv.referidorOrganizador].filter(
          (r): r is string => r != null,
        ),
      ),
    ];
    const consultas = await Promise.all(receptores.map((r) => clientes.consents.getConsent(r)));
    if (consultas.some((c) => c?.status !== "ACTIVE")) {
      console.warn("[split-1n-piloto] consentimiento_no_activo", { pedidoId: order.id });
      // Queda guardado en CLF: el próximo pedido ya no se desvía al pago con tarjeta.
      if (config.receptoresDesdeClf && config.ownerUserId) {
        await aplicarEstadosConsultados(crearRepositorioConsentimiento(config.ownerUserId), consultas);
      }
      return { ok: false, codigo: "CONSENTIMIENTO_NO_ACTIVO" };
    }
    // Quien paga no puede cobrar: se compara con los correos de Mercado Pago y con los de CLF.
    const correosReceptores = [
      ...consultas.map((c) => (c?.sellerEmail ?? "").toLowerCase()),
      ...(cuenta.email ? [cuenta.email.toLowerCase()] : []),
      ...(await correosClf([
        photographerUserId,
        referrerUserId,
        rcv.organizador != null ? organizador?.userId ?? null : null,
        rcv.referidorOrganizador != null ? organizador?.referrerUserId ?? null : null,
      ])),
    ];

    const preparado = prepararCobro({
      estadoPedido: order.status,
      marca,
      totalPesos: order.totalCents,
      feePesos,
      basePesos,
      porcentajeOrganizador: organizador?.porcentaje ?? 0,
      receivers: elegibilidad.receivers,
      payerEmail: order.buyerEmail,
      correosReceptores,
    });
    if (!preparado.ok) return { ok: false, codigo: preparado.codigo };
    cobro = preparado;
  } catch (err: unknown) {
    console.error("[split-1n-piloto] preparacion_fallida", {
      pedidoId: order.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, codigo: "PREPARACION_FALLIDA" };
  }

  // Quiénes de CLF cobran por el split: al confirmar, sus comisiones nacen pagadas.
  const quienesCobran = {
    referidorUserId: elegibilidad.receivers.referidor != null ? referrerUserId : null,
    organizadorUserId:
      elegibilidad.receivers.organizador != null && cobro.reparto.organizador > 0
        ? organizador?.userId ?? null
        : null,
    referidorOrganizadorUserId:
      elegibilidad.receivers.referidorOrganizador != null && cobro.reparto.referidorOrganizador > 0
        ? organizador?.referrerUserId ?? null
        : null,
    reparto: cobro.reparto,
  };

  return { ok: true, clientes, cobro, quienesCobran };
}
