import { OrderOrigin } from "@prisma/client";
import { assertLiveCollectorAccount } from "@repo/payments/mercado-pago";
import { prisma } from "@/lib/prisma";
import { aplicarEstadosConsultados } from "../split-1n-consentimiento/servicio";
import { crearRepositorioConsentimiento } from "../split-1n-consentimiento/repositorio";
import type { PilotoConfig } from "../split-1n-piloto/config";
import { crearClientesPiloto } from "../split-1n-piloto/mp";
import { buscarOrganizador } from "../split-1n-piloto/organizador";
import { buscarReferidorActivo } from "../split-1n-piloto/referidor";
import type { EstadoPiloto } from "../split-1n-piloto/snapshot";
import type { GrupoCargado, PedidoDelGrupoCargado } from "./cargar";
import { prepararCobroGrupo } from "./cobro-grupo";
import type { CarritoConfig } from "./config";
import { evaluarElegibilidadGrupo } from "./elegibilidad-grupo";
import type { MarcaGrupo } from "./marca";

export { mensajeGrupo } from "./mensajes-grupo";

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

export type GrupoPreparado =
  | {
      ok: true;
      clientes: ReturnType<typeof crearClientesPiloto>;
      cobro: Extract<ReturnType<typeof prepararCobroGrupo>, { ok: true }>;
      payerEmail: string;
      /** Quiénes de CLF cobran por el split en ese pedido y su reparto (va en la marca). */
      cobroDelPedido(p: PedidoDelGrupoCargado): NonNullable<MarcaGrupo["cobro"]>;
    }
  | { ok: false; codigo: string };

/**
 * Todo lo que se decide antes de cobrar un carrito de evento, con la tarjeta o con Mercado
 * Pago: elegibilidad vuelta a mirar (entre el carrito y el pago pudo cambiar algo), cuenta
 * cobradora real, consentimiento ACTIVO de cada receptor consultado a Mercado Pago, y el
 * reparto de cada pedido. Nunca lanza.
 */
export async function prepararPagoGrupo(params: {
  grupo: GrupoCargado;
  piloto: PilotoConfig;
  carrito: CarritoConfig;
  /** Estado del cobro del grupo con el que se evalúa (`PENDIENTE` para un intento nuevo). */
  estadoGrupo: EstadoPiloto | null;
}): Promise<GrupoPreparado> {
  const { grupo, piloto, carrito } = params;
  const grupoId = grupo.grupoId;
  try {
    const { organizador, referidores, albumes } = await evaluarGrupo(grupo);
    const elegibilidad = evaluarElegibilidadGrupo({ piloto, carrito, eventId: grupo.eventId ?? -1, albumes });
    if (!elegibilidad.ok) {
      console.info("[carrito-evento] pago_no_elegible", { grupoId, motivos: elegibilidad.motivos });
      return { ok: false, codigo: "NO_DISPONIBLE" };
    }

    const payerEmail = grupo.pedidos[0].order.buyerEmail;
    const clientes = crearClientesPiloto(piloto);
    const cuenta = await assertLiveCollectorAccount(clientes.http);

    const receptores = new Set<string>();
    for (const r of elegibilidad.receivers.values()) {
      for (const c of [r.fotografo, r.referidor, r.organizador, r.referidorOrganizador]) if (c != null) receptores.add(c);
    }
    const consultas = await Promise.all([...receptores].map((r) => clientes.consents.getConsent(r)));
    if (consultas.some((c) => c?.status !== "ACTIVE")) {
      console.warn("[carrito-evento] consentimiento_no_activo", { grupoId });
      if (piloto.receptoresDesdeClf && piloto.ownerUserId) {
        await aplicarEstadosConsultados(crearRepositorioConsentimiento(piloto.ownerUserId), consultas);
      }
      return { ok: false, codigo: "CONSENTIMIENTO_NO_ACTIVO" };
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

    const cobro = prepararCobroGrupo({
      pedidos: grupo.pedidos.map((p) => ({
        pedidoId: p.order.id,
        estadoPedido: p.order.status,
        totalPesos: p.order.totalCents,
        feePesos: p.feePesos,
        basePesos: p.basePesos,
        porcentajeOrganizador: organizador?.porcentaje ?? 0,
        receivers: elegibilidad.receivers.get(p.order.albumId)!,
      })),
      estadoGrupo: params.estadoGrupo,
      payerEmail,
      correosReceptores,
      maxReceptores: carrito.maxReceptores,
    });
    if (!cobro.ok) return { ok: false, codigo: cobro.codigo };

    return {
      ok: true,
      clientes,
      cobro,
      payerEmail,
      cobroDelPedido(p) {
        const rcv = elegibilidad.receivers.get(p.order.albumId)!;
        const reparto = cobro.repartos.get(p.order.id)!;
        const photographerUserId = p.order.album?.userId ?? null;
        return {
          referidorUserId:
            rcv.referidor != null && photographerUserId != null ? referidores.get(photographerUserId) ?? null : null,
          organizadorUserId: rcv.organizador != null && reparto.organizador > 0 ? organizador?.userId ?? null : null,
          referidorOrganizadorUserId:
            rcv.referidorOrganizador != null && reparto.referidorOrganizador > 0
              ? organizador?.referrerUserId ?? null
              : null,
          reparto,
        };
      },
    };
  } catch (err: unknown) {
    console.error("[carrito-evento] preparacion_fallida", {
      grupoId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, codigo: "ERROR_PREPARACION" };
  }
}
