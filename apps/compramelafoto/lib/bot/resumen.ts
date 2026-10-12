import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";
import { BOT_PLATFORM, readBotConfig } from "@/lib/bot/config";
import { argentinaDay, argentinaMonthPrefix } from "@/lib/bot/dia-argentino";
import { prisma } from "@/lib/prisma";

/** Herramientas que cambian algo del álbum que puede destrabar ventas. */
export const UNLOCKING_TOOLS = [
  "actualizar_album",
  "configurar_venta_por_reconocimiento",
  "crear_pack_digital",
  "editar_pack",
  "extender_vencimiento",
] as const;

/** Argentina no tiene horario de verano desde 2009: medianoche argentina = 03:00 UTC. */
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Ventanas del mes en hora argentina, como instantes (Order.createdAt se compara en UTC):
 * - actual: del 1 a las 00:00 hasta `now`.
 * - anterior: del 1 del mes anterior hasta el mismo día y la misma hora; si ese día no existe
 *   (p. ej. 31/10 → septiembre tiene 30), hasta el final del último día del mes anterior.
 */
export function salesWindows(now: Date) {
  const ar = new Date(now.getTime() - AR_OFFSET_MS); // campos UTC = reloj argentino
  const y = ar.getUTCFullYear();
  const mo = ar.getUTCMonth();
  const d = ar.getUTCDate();
  const msOfDay = ar.getTime() - Date.UTC(y, mo, d);
  const currentStart = new Date(Date.UTC(y, mo, 1) + AR_OFFSET_MS);
  const previousStart = new Date(Date.UTC(y, mo - 1, 1) + AR_OFFSET_MS);
  const lastDayPrev = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const previousEnd =
    d > lastDayPrev ? currentStart : new Date(Date.UTC(y, mo - 1, d) + msOfDay + AR_OFFSET_MS);
  return { currentStart, currentEnd: now, previousStart, previousEnd };
}

const PAID_SALE = { status: "PAID" as const, isTest: false, totalCents: { gt: 0 } };

async function salesBetween(gte: Date, lt: Date) {
  const r = await prisma.order.aggregate({
    where: { ...PAID_SALE, createdAt: { gte, lt } },
    _count: { _all: true },
    _sum: { totalCents: true },
  });
  // totalCents de Order son pesos enteros (no centavos).
  return { count: r._count._all, pesos: r._sum.totalCents ?? 0 };
}

async function unlockedAlbums(monthStart: Date) {
  const actions = await prisma.botAction.findMany({
    where: {
      platform: BOT_PLATFORM,
      status: "EXECUTED",
      toolName: { in: [...UNLOCKING_TOOLS] },
      decidedAt: { gte: monthStart },
    },
    select: { input: true, decidedAt: true },
  });
  const firstChange = new Map<number, Date>();
  for (const a of actions) {
    const albumId = (a.input as { albumId?: unknown } | null)?.albumId;
    if (typeof albumId !== "number" || !Number.isInteger(albumId) || !a.decidedAt) continue;
    const prev = firstChange.get(albumId);
    if (!prev || a.decidedAt < prev) firstChange.set(albumId, a.decidedAt);
  }
  if (firstChange.size === 0) return { albums: 0, pesos: 0 };
  const r = await prisma.order.aggregate({
    where: {
      ...PAID_SALE,
      OR: [...firstChange].map(([albumId, at]) => ({ albumId, createdAt: { gt: at } })),
    },
    _sum: { totalCents: true },
  });
  return { albums: firstChange.size, pesos: r._sum.totalCents ?? 0 };
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function salesLine(cur: { count: number; pesos: number }, prev: { count: number; pesos: number }): string {
  const head = `Ventas del mes hasta hoy: ${plural(cur.count, "pedido", "pedidos")}, ${formatPurchaseArs(cur.pesos)}`;
  if (prev.pesos === 0) return `${head} (sin ventas el mes anterior en el mismo período).`;
  const pct = Math.round(((cur.pesos - prev.pesos) / prev.pesos) * 100);
  const signed = pct > 0 ? `+${pct}` : `${pct}`;
  return `${head} (mismo período del mes anterior: ${plural(prev.count, "pedido", "pedidos")}, ${formatPurchaseArs(prev.pesos)}; ${signed} %).`;
}

function usd(microUsd: number, minDecimals: number) {
  return (microUsd / 1_000_000).toLocaleString("es-AR", { minimumFractionDigits: minDecimals, maximumFractionDigits: 2 });
}

export async function buildDailySummary(now: Date): Promise<string> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const where = { platform: BOT_PLATFORM, createdAt: { gt: since } };
  const w = salesWindows(now);
  const [total, byStatus, actions, incidents, month, salesNow, salesPrev, unlocked] = await Promise.all([
    prisma.botConversation.count({ where }),
    prisma.botConversation.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.botAction.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.botIncident.findMany({
      where: { platform: BOT_PLATFORM, status: { in: ["OPEN", "INVESTIGATING"] }, lastSeenAt: { gt: since } },
      orderBy: { occurrences: "desc" },
      take: 10,
      select: { title: true, occurrences: true, urgent: true },
    }),
    prisma.botUsageDaily.aggregate({
      where: { platform: BOT_PLATFORM, day: { startsWith: argentinaMonthPrefix(now) } },
      _sum: { costMicroUsd: true },
    }),
    salesBetween(w.currentStart, w.currentEnd),
    salesBetween(w.previousStart, w.previousEnd),
    unlockedAlbums(w.currentStart),
  ]);
  const esc = byStatus.find((s) => s.status === "ESCALATED")?._count._all ?? 0;
  const done = actions.find((s) => s.status === "EXECUTED")?._count._all ?? 0;
  const failed = actions.find((s) => s.status === "FAILED")?._count._all ?? 0;
  // La factura de la API de Claude es genuinamente en dólares (no son pesos).
  const spent = usd(month._sum.costMicroUsd ?? 0, 2);
  const cap = usd(readBotConfig().limits.monthlyCapMicroUsd, 0);
  return [
    `🤖 DNX Bot · CLF · resumen al ${argentinaDay(now)}`,
    `${total} conversaciones, ${total - esc} resueltas sin ticket, ${esc} derivadas.`,
    `${done} acciones hechas${failed ? `, ${failed} fallidas` : ""}.`,
    incidents.length
      ? `Errores del sistema:\n${incidents.map((i) => `- ${i.urgent ? "🚨 " : ""}${i.title} (×${i.occurrences})`).join("\n")}`
      : "Sin errores del sistema.",
    salesLine(salesNow, salesPrev),
    `Gasto del bot este mes: USD ${spent} de USD ${cap} (se factura en dólares).`,
    `Álbumes destrabados por el bot: ${unlocked.albums} (ventas desde que el bot los cambió: ${formatPurchaseArs(unlocked.pesos)}).`,
  ].join("\n");
}
