import { PREFIJO_INVITADO } from "@/lib/bot/actor-key";
import { ventasPosteriores } from "@/lib/bot/comprador/metricas";
import { BOT_PLATFORM } from "@/lib/bot/config";
import { prisma } from "@/lib/prisma";
import { cotizacionDolar, type Cotizacion } from "./dolar";
import { periodosFinDeSemana, periodosMensuales, type Periodo, type TipoComparativa } from "./periodos";
import { formatearComparativa, type DatosComparativa, type UsoAudiencia, type Ventas } from "./texto";

const HORA_MS = 60 * 60 * 1000;
/** Misma ventana que `ventasPosteriores` (metricas.ts) para compradores. */
const VENTANA_COMPRADORES_MS = 48 * HORA_MS;
/** Un fotógrafo que habló con el bot "vendió después" si vendió dentro de estos 30 días. */
export const VENTANA_FOTOGRAFOS_MS = 30 * 24 * HORA_MS;
/** Topes para que el cron siga acotado aunque haya mucha actividad. */
const MAX_CONVERSACIONES = 5_000;
const MAX_PEDIDOS = 20_000;
const MAX_VENDEDORES = 2_000;
const PREFIJO_USUARIO = "u:";

/**
 * Venta pagada: misma regla que el resumen diario. No hay fecha de pago en Order (sólo `createdAt`,
 * `updatedAt` y fechas de entrega), así que el día de la venta es `createdAt`, como en resumen.ts.
 */
const VENTA_PAGADA = { status: "PAID" as const, isTest: false, totalCents: { gt: 0 } };

export type ConvFotografo = { userId: number; createdAt: Date };
export type PedidoFotografo = { userId: number; totalCents: number; createdAt: Date };

/**
 * Pedidos de un fotógrafo creados después de alguna de sus conversaciones con el bot y a lo sumo
 * `ventanaMs` después. Cada pedido cuenta una vez. `totalCents` son pesos enteros.
 */
export function ventasFotografosPosteriores(
  convs: ConvFotografo[],
  pedidos: PedidoFotografo[],
  ventanaMs: number = VENTANA_FOTOGRAFOS_MS,
): { vendieron: number; pedidos: number; pesos: number } {
  const porUsuario = new Map<number, number[]>();
  for (const c of convs) porUsuario.set(c.userId, [...(porUsuario.get(c.userId) ?? []), c.createdAt.getTime()]);
  const vendedores = new Set<number>();
  let cantidad = 0;
  let pesos = 0;
  for (const o of pedidos) {
    const t = o.createdAt.getTime();
    const tiempos = porUsuario.get(o.userId) ?? [];
    if (tiempos.some((c) => t - c > 0 && t - c <= ventanaMs)) {
      vendedores.add(o.userId);
      cantidad++;
      pesos += o.totalCents;
    }
  }
  return { vendieron: vendedores.size, pedidos: cantidad, pesos };
}

async function ventasEntre(p: Periodo): Promise<Ventas> {
  const r = await prisma.order.aggregate({
    where: { ...VENTA_PAGADA, createdAt: { gte: p.inicio, lt: p.fin } },
    _count: { _all: true },
    _sum: { totalCents: true },
  });
  return { pedidos: r._count._all, pesos: r._sum.totalCents ?? 0 };
}

async function usoDe(p: Periodo, prefijo: string, audiencia: "PHOTOGRAPHER" | "BUYER"): Promise<UsoAudiencia> {
  const [uso, conversaciones] = await Promise.all([
    prisma.botUsageDaily.aggregate({
      where: { platform: BOT_PLATFORM, day: { gte: p.desde, lte: p.hasta }, actorKey: { startsWith: prefijo } },
      _sum: { costMicroUsd: true, messages: true },
    }),
    prisma.botConversation.count({
      where: { platform: BOT_PLATFORM, audience: audiencia, createdAt: { gte: p.inicio, lt: p.fin } },
    }),
  ]);
  return { costoMicroUsd: uso._sum.costMicroUsd ?? 0, mensajes: uso._sum.messages ?? 0, conversaciones };
}

async function costoTotal(p: Periodo): Promise<number> {
  const r = await prisma.botUsageDaily.aggregate({
    where: { platform: BOT_PLATFORM, day: { gte: p.desde, lte: p.hasta } },
    _sum: { costMicroUsd: true },
  });
  return r._sum.costMicroUsd ?? 0;
}

/** Pedidos del período que llegaron hasta 48 h después de una conversación de comprador (como metricas.ts). */
async function ayudaCompradores(p: Periodo): Promise<Ventas> {
  const convs = await prisma.botConversation.findMany({
    where: {
      platform: BOT_PLATFORM,
      audience: "BUYER",
      albumId: { not: null },
      createdAt: { gte: new Date(p.inicio.getTime() - VENTANA_COMPRADORES_MS), lt: p.fin },
    },
    select: { guestKey: true, buyerEmail: true, albumId: true, createdAt: true },
    take: MAX_CONVERSACIONES,
  });
  const albumes = [...new Set(convs.map((c) => c.albumId).filter((id): id is number => id != null))];
  if (albumes.length === 0) return { pedidos: 0, pesos: 0 };
  const pedidos = await prisma.order.findMany({
    where: { ...VENTA_PAGADA, createdAt: { gte: p.inicio, lt: p.fin }, albumId: { in: albumes } },
    select: { albumId: true, botGuestKey: true, buyerEmail: true, totalCents: true, createdAt: true },
    take: MAX_PEDIDOS,
  });
  return ventasPosteriores(convs, pedidos, VENTANA_COMPRADORES_MS);
}

/** Fotógrafos que hablaron con el bot en el período y cuántos vendieron en los 30 días siguientes. */
async function ayudaFotografos(p: Periodo, now: Date): Promise<DatosComparativa["ayudaFotografos"]> {
  const filas = await prisma.botConversation.findMany({
    where: { platform: BOT_PLATFORM, audience: "PHOTOGRAPHER", userId: { not: null }, createdAt: { gte: p.inicio, lt: p.fin } },
    select: { userId: true, createdAt: true },
    take: MAX_CONVERSACIONES,
  });
  const convs = filas.filter((c): c is ConvFotografo => c.userId != null);
  const usuarios = new Set(convs.map((c) => c.userId));
  const ventanaAbierta = p.fin.getTime() + VENTANA_FOTOGRAFOS_MS > now.getTime();
  if (usuarios.size === 0) return { hablaron: 0, vendieron: 0, pedidos: 0, pesos: 0, ventanaAbierta };
  const primera = Math.min(...convs.map((c) => c.createdAt.getTime()));
  const ultima = Math.max(...convs.map((c) => c.createdAt.getTime()));
  const pedidos = await prisma.order.findMany({
    where: {
      ...VENTA_PAGADA,
      album: { userId: { in: [...usuarios] } },
      createdAt: { gt: new Date(primera), lte: new Date(ultima + VENTANA_FOTOGRAFOS_MS) },
    },
    select: { totalCents: true, createdAt: true, album: { select: { userId: true } } },
    take: MAX_PEDIDOS,
  });
  const r = ventasFotografosPosteriores(
    convs,
    pedidos.map((o) => ({ userId: o.album.userId, totalCents: o.totalCents, createdAt: o.createdAt })),
  );
  return { hablaron: usuarios.size, ...r, ventanaAbierta };
}

/** Fotógrafos cuya primera venta pagada de toda su historia cayó en el período, y cuántos hablaron con el bot antes del cierre. */
async function primerasVentas(p: Periodo): Promise<DatosComparativa["primerasVentas"]> {
  const delPeriodo = await prisma.album.findMany({
    where: { orders: { some: { ...VENTA_PAGADA, createdAt: { gte: p.inicio, lt: p.fin } } } },
    select: { userId: true },
    distinct: ["userId"],
    take: MAX_VENDEDORES,
  });
  const candidatos = delPeriodo.map((a) => a.userId);
  if (candidatos.length === 0) return { fotografos: 0, hablaronConElBot: 0 };
  const previos = await prisma.album.findMany({
    where: { userId: { in: candidatos }, orders: { some: { ...VENTA_PAGADA, createdAt: { lt: p.inicio } } } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const yaVendian = new Set(previos.map((a) => a.userId));
  const nuevos = candidatos.filter((id) => !yaVendian.has(id));
  if (nuevos.length === 0) return { fotografos: 0, hablaronConElBot: 0 };
  const conBot = await prisma.botConversation.findMany({
    where: { platform: BOT_PLATFORM, audience: "PHOTOGRAPHER", userId: { in: nuevos }, createdAt: { lt: p.fin } },
    select: { userId: true },
    distinct: ["userId"],
  });
  return { fotografos: nuevos.length, hablaronConElBot: conBot.length };
}

function promedio(lista: Ventas[]): Ventas {
  const n = lista.length || 1;
  return {
    pedidos: Math.round(lista.reduce((s, v) => s + v.pedidos, 0) / n),
    pesos: Math.round(lista.reduce((s, v) => s + v.pesos, 0) / n),
  };
}

export async function juntarDatos(
  tipo: TipoComparativa,
  now: Date,
  obtenerCotizacion: () => Promise<Cotizacion | null> = () => cotizacionDolar(),
): Promise<DatosComparativa> {
  const mensual = tipo === "mensual" ? periodosMensuales(now) : null;
  const { actual, anterior } = mensual ?? periodosFinDeSemana();
  const [
    costoTotalMicroUsd, fotografos, compradores, ventasActual, ventasAnterior, previos,
    ayudaComp, ayudaFot, primeras, cotizacion,
  ] = await Promise.all([
    costoTotal(actual),
    usoDe(actual, PREFIJO_USUARIO, "PHOTOGRAPHER"),
    usoDe(actual, PREFIJO_INVITADO, "BUYER"),
    ventasEntre(actual),
    ventasEntre(anterior),
    mensual ? Promise.all(mensual.previos.map(ventasEntre)) : Promise.resolve(null),
    ayudaCompradores(actual),
    ayudaFotografos(actual, now),
    primerasVentas(actual),
    obtenerCotizacion(),
  ]);
  return {
    tipo,
    actual,
    anterior,
    ...(previos ? { promedioPrevios: promedio(previos) } : {}),
    costoTotalMicroUsd,
    fotografos,
    compradores,
    ventasActual,
    ventasAnterior,
    ayudaCompradores: ayudaComp,
    ayudaFotografos: ayudaFot,
    primerasVentas: primeras,
    cotizacion,
    parcial: actual.fin.getTime() > now.getTime(),
  };
}

export async function buildComparativa(tipo: TipoComparativa, now: Date): Promise<string> {
  return formatearComparativa(await juntarDatos(tipo, now));
}
