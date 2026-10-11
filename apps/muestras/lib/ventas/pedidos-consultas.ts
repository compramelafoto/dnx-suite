import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { editionLabel, isOrderStatus, ORDER_STATUSES, PENDING_HOLD_HOURS } from "@repo/muestras";
import { puede, rolEnMuestra } from "@/lib/equipo/permisos";
import type { Usuario } from "@/lib/usuario";

/**
 * Consultas de los pedidos (etapa 8, tarea 16) para la organización, el super admin y el autor.
 * Cada una recibe a quien mira y lee el permiso en la base; nunca es una acción de servidor.
 */
type Quien = Pick<Usuario, "id" | "esSuperAdmin">;

const PEDIDO = {
  id: true, publicId: true, activityId: true, offerId: true, copyId: true, isTest: true, buyerName: true, buyerEmail: true, buyerPhone: true,
  buyerOnCertificate: true, delivery: true, shippingAddress: true, priceArs: true, shippingArs: true, totalCents: true, platformCents: true,
  organizerCents: true, photographerCents: true, status: true, fulfillment: true, trackingText: true, providerStatus: true, createdAt: true,
  paidAt: true, refundRequestedAt: true, regretRequestedAt: true, refundedAt: true, holdExpiresAt: true,
} as const;
type FilaPedido = Prisma.CulturalSaleOrderGetPayload<{ select: typeof PEDIDO }>;

/** Las alertas que el panel muestra en rojo. */
export const ALERTAS = ["MISMATCH", "ALERT_NO_CERT_KEY", "ALERT_NO_CERT_DATA", "ALERT_LIVE_ON_TEST", "ALERT_UNKNOWN_CREATE", "ALERT_PAID_ON_TERMINAL", "PARTIALLY_REFUNDED"];

async function completar(filas: FilaPedido[], { historial }: { historial: boolean }) {
  const ofertas = filas.length
    ? await prisma.culturalWorkOffer.findMany({
        where: { id: { in: [...new Set(filas.map((f) => f.offerId))] } },
        select: { id: true, activityWorkId: true, format: true, editionKind: true, editionSize: true, proofCount: true, paper: true, widthCm: true, heightCm: true },
      })
    : [];
  const [obras, copias, eventos, actividades] = await Promise.all([
    ofertas.length ? prisma.culturalActivityWork.findMany({ where: { id: { in: ofertas.map((o) => o.activityWorkId) } }, select: { id: true, title: true, authorName: true } }) : [],
    filas.some((f) => f.copyId)
      ? prisma.culturalEditionCopy.findMany({ where: { id: { in: filas.map((f) => f.copyId).filter((x): x is string => !!x) } }, select: { id: true, kind: true, number: true, status: true, certificateCode: true } })
      : [],
    filas.length
      ? prisma.culturalSaleEvent.findMany({
          where: { orderId: { in: filas.map((f) => f.id) } },
          select: { orderId: true, source: true, fromStatus: true, toStatus: true, detail: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        })
      : [],
    filas.length ? prisma.culturalActivity.findMany({ where: { id: { in: [...new Set(filas.map((f) => f.activityId))] } }, select: { id: true, title: true } }) : [],
  ]);
  return filas.map((f) => {
    const o = ofertas.find((x) => x.id === f.offerId) ?? null;
    const w = o ? obras.find((x) => x.id === o.activityWorkId) ?? null : null;
    const c = f.copyId ? copias.find((x) => x.id === f.copyId) ?? null : null;
    const ev = eventos.filter((e) => e.orderId === f.id);
    return {
      ...f,
      muestra: actividades.find((a) => a.id === f.activityId)?.title ?? "",
      obra: w ? { id: w.id, title: w.title, authorName: w.authorName } : null,
      formato: o?.format ?? null,
      detalleFormato: o && o.format === "PRINT" ? [o.paper, o.widthCm != null && o.heightCm != null ? `${o.widthCm} × ${o.heightCm} cm` : null].filter(Boolean).join(", ") : null,
      numero: c && o ? editionLabel({ kind: c.kind, number: c.number, size: o.editionSize, editionKind: o.editionKind, proofCount: o.proofCount }) : null,
      copia: c,
      alertas: [...new Set(ev.map((e) => ALERTAS.find((a) => e.detail?.startsWith(a))).filter((x): x is string => !!x))],
      historial: historial ? ev : [],
    };
  });
}

export type PedidoDelPanel = Awaited<ReturnType<typeof completar>>[number];

const filtroDeEstado = (estado?: string | null): Prisma.CulturalSaleOrderWhereInput =>
  estado && isOrderStatus(estado) ? { status: estado } : estado === "ALERTAS" ? { OR: [{ status: "PAID_NO_COPY" }, { refundRequestedAt: { not: null }, refundedAt: null }, { regretRequestedAt: { not: null }, refundedAt: null }] } : {};

/**
 * Los pedidos de una muestra para quien prepara las copias (`salesFulfill`) o la organiza (`sales`).
 * `null` sin permiso (la página responde 404).
 */
export async function pedidosDeLaMuestra(activityId: string, usuario: Quien, estado?: string | null) {
  const rol = await rolEnMuestra(activityId, usuario);
  if (!rol) return null;
  const esDueno = puede(usuario, "sales", rol.role);
  if (!esDueno && !puede(usuario, "salesFulfill", rol.role)) return null;
  const actividad = await prisma.culturalActivity.findUnique({ where: { id: activityId }, select: { id: true, title: true, type: true } });
  if (!actividad || actividad.type !== "MUESTRA") return null;
  const filas = await prisma.culturalSaleOrder.findMany({
    where: { activityId, ...filtroDeEstado(estado) },
    select: PEDIDO,
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  // Lo que pide atención: cobrado sin copia y devoluciones o arrepentimientos pedidos sin resolver.
  const atencion = await prisma.culturalSaleOrder.count({
    where: { activityId, OR: [{ status: "PAID_NO_COPY" }, { refundRequestedAt: { not: null }, refundedAt: null }, { regretRequestedAt: { not: null }, refundedAt: null }] },
  });
  // Pruebas de autor: formatos aprobados con P/A sin emitir.
  const ofertas = await prisma.culturalWorkOffer.findMany({
    where: { activityId, proofCount: { gt: 0 }, status: { in: ["APPROVED", "PAUSED"] } },
    select: { id: true, activityWorkId: true, format: true, proofCount: true, copies: { where: { kind: "PROOF", status: "ISSUED" }, select: { id: true, number: true, isTest: true, certificateCode: true } } },
  });
  const obras = ofertas.length
    ? await prisma.culturalActivityWork.findMany({ where: { id: { in: ofertas.map((o) => o.activityWorkId) } }, select: { id: true, title: true } })
    : [];
  return {
    actividad,
    esDueno,
    esSuperAdmin: usuario.esSuperAdmin,
    atencion,
    pedidos: await completar(filas, { historial: true }),
    pruebasDeAutor: ofertas.map((o) => ({
      id: o.id,
      obra: obras.find((w) => w.id === o.activityWorkId)?.title ?? "",
      format: o.format,
      proofCount: o.proofCount,
      emitidas: o.copies.sort((a, b) => a.number - b.number),
    })),
  };
}

export type PedidosDeLaMuestra = NonNullable<Awaited<ReturnType<typeof pedidosDeLaMuestra>>>;

const HORA = 60 * 60_000;

/** Todos los pedidos de la plataforma (super admin), con las alertas y lo pendiente de devolver. */
export async function pedidosDeLaPlataforma(usuario: Quien, estado?: string | null, ahora: Date = new Date()) {
  if (!usuario.esSuperAdmin) return null;
  const viejo = new Date(ahora.getTime() - PENDING_HOLD_HOURS * HORA);
  const [filas, alertas, pendientesViejos, muestrasConPrueba] = await Promise.all([
    prisma.culturalSaleOrder.findMany({ where: filtroDeEstado(estado), select: PEDIDO, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.culturalSaleEvent.findMany({
      where: { OR: ALERTAS.map((a) => ({ detail: { startsWith: a } })) },
      select: { orderId: true },
      distinct: ["orderId"],
      take: 300,
    }),
    prisma.culturalSaleOrder.findMany({ where: { status: "PENDING_PAYMENT", createdAt: { lt: viejo } }, select: PEDIDO, take: 100 }),
    prisma.culturalSaleOrder.groupBy({ by: ["activityId"], where: { isTest: true }, _count: { _all: true } }),
  ]);
  const conAlerta = alertas.length
    ? await prisma.culturalSaleOrder.findMany({ where: { id: { in: alertas.map((a) => a.orderId) } }, select: PEDIDO })
    : [];
  const atencion = await prisma.culturalSaleOrder.findMany({
    where: { OR: [{ status: "PAID_NO_COPY" }, { refundRequestedAt: { not: null }, refundedAt: null }, { regretRequestedAt: { not: null }, refundedAt: null }] },
    select: PEDIDO,
    take: 300,
  });
  const muestras = muestrasConPrueba.length
    ? await prisma.culturalActivity.findMany({ where: { id: { in: muestrasConPrueba.map((m) => m.activityId) } }, select: { id: true, title: true } })
    : [];
  const unicos = (xs: FilaPedido[]) => [...new Map(xs.map((x) => [x.id, x])).values()];
  return {
    estados: ORDER_STATUSES,
    pedidos: await completar(filas, { historial: false }),
    atencion: await completar(unicos([...atencion, ...conAlerta, ...pendientesViejos]), { historial: true }),
    pruebas: muestrasConPrueba.map((m) => ({ activityId: m.activityId, title: muestras.find((x) => x.id === m.activityId)?.title ?? m.activityId, cantidad: m._count._all })),
  };
}

/**
 * "Tus ventas" del autor: por obra y formato, fecha, número, estado y su parte. **Sin datos del
 * comprador**, salvo el nombre si aceptó figurar en el certificado.
 */
export async function ventasDelAutor(activityId: string, usuario: Quien) {
  const ofertas = await prisma.culturalWorkOffer.findMany({
    where: { activityId, authorUserId: usuario.id },
    select: { id: true, activityWorkId: true, format: true, editionKind: true, editionSize: true, proofCount: true },
  });
  if (!ofertas.length) return [];
  const [pedidos, obras] = await Promise.all([
    prisma.culturalSaleOrder.findMany({
      where: { activityId, offerId: { in: ofertas.map((o) => o.id) }, status: { in: ["PAID", "PAID_NO_COPY", "REFUNDED", "CHARGED_BACK"] } },
      select: { id: true, offerId: true, copyId: true, isTest: true, status: true, paidAt: true, photographerCents: true, buyerName: true, buyerOnCertificate: true },
      orderBy: { paidAt: "desc" },
    }),
    prisma.culturalActivityWork.findMany({ where: { id: { in: ofertas.map((o) => o.activityWorkId) } }, select: { id: true, title: true } }),
  ]);
  const copias = pedidos.some((p) => p.copyId)
    ? await prisma.culturalEditionCopy.findMany({ where: { id: { in: pedidos.map((p) => p.copyId).filter((x): x is string => !!x) } }, select: { id: true, kind: true, number: true } })
    : [];
  return pedidos.map((p) => {
    const o = ofertas.find((x) => x.id === p.offerId)!;
    const c = copias.find((x) => x.id === p.copyId) ?? null;
    return {
      id: p.id,
      obra: obras.find((w) => w.id === o.activityWorkId)?.title ?? "",
      formato: o.format,
      numero: c ? editionLabel({ kind: c.kind, number: c.number, size: o.editionSize, editionKind: o.editionKind, proofCount: o.proofCount }) : null,
      status: p.status,
      prueba: p.isTest,
      fecha: p.paidAt,
      tuParteCents: p.photographerCents,
      comprador: p.buyerOnCertificate ? p.buyerName : null,
    };
  });
}

/**
 * Pedidos pagados de copias impresas que todavía no se entregaron, por muestra (contador del
 * tablero). Llamar con ids donde la persona tiene `salesFulfill`.
 */
export async function pedidosParaProducir(ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const filas = await prisma.culturalSaleOrder.groupBy({
    by: ["activityId"],
    where: { activityId: { in: ids }, status: "PAID", fulfillment: { in: ["PENDING", "IN_PRODUCTION"] } },
    _count: { _all: true },
  });
  return new Map(filas.map((f) => [f.activityId, f._count._all]));
}
