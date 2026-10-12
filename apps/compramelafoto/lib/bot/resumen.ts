import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";
import { BOT_PLATFORM, readBotConfig } from "@/lib/bot/config";
import { argentinaDay, argentinaMonthPrefix } from "@/lib/bot/dia-argentino";
import { computeSchoolSetupProgress } from "@/lib/bot/escolar/progreso";
import { prisma } from "@/lib/prisma";

const DIA_MS = 24 * 60 * 60 * 1000;
/** Topes para que el cron siga acotado aunque haya mucha actividad. */
const MAX_MAILS = 500;
const MAX_VENDEDORES = 500;
const MAX_ALBUMES_ESCOLARES = 50;
const VENTANA_ESCOLAR_DIAS = 120;

const NOMBRE_CAMPANA: Record<string, string> = {
  nuevo: "nuevo",
  sin_ventas: "sin ventas",
  sin_escolar: "sin escolar",
  escolar_en_curso: "escolar en curso",
};

type FilaSaludo = { campaign: string; status: string; _count: { _all: number } };

/** Saludos del panel de las últimas 24 h, por campaña. Determinístico. */
function lineaSaludos(filas: FilaSaludo[]): string {
  if (filas.length === 0) return "Saludos: ninguno en las últimas 24 h.";
  const porCampana = new Map<string, { mostrados: number; tocados: number; rechazados: number }>();
  for (const f of filas) {
    const c = porCampana.get(f.campaign) ?? { mostrados: 0, tocados: 0, rechazados: 0 };
    const n = f._count._all;
    c.mostrados += n;
    if (f.status === "CLICKED") c.tocados += n;
    if (f.status === "DECLINED") c.rechazados += n;
    porCampana.set(f.campaign, c);
  }
  const total = { mostrados: 0, tocados: 0, rechazados: 0 };
  const detalle: string[] = [];
  for (const [campana, c] of [...porCampana.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    total.mostrados += c.mostrados;
    total.tocados += c.tocados;
    total.rechazados += c.rechazados;
    detalle.push(`${NOMBRE_CAMPANA[campana] ?? campana}: ${c.mostrados}/${c.tocados}/${c.rechazados}`);
  }
  return `Saludos: ${total.mostrados} mostrados, ${total.tocados} tocados, ${total.rechazados} rechazados (por campaña, mostrados/tocados/rechazados: ${detalle.join("; ")}).`;
}

/** Mails enviados en las últimas 24 h y cuántos de esos fotógrafos entraron después del envío. */
async function lineaMails(since: Date): Promise<string> {
  const enviados = await prisma.botOutreach.findMany({
    where: { platform: BOT_PLATFORM, channel: "EMAIL", status: "SENT", createdAt: { gt: since } },
    select: { userId: true, createdAt: true },
    take: MAX_MAILS,
  });
  if (enviados.length === 0) return "Mails: 0 enviados.";
  const usuarios = await prisma.user.findMany({
    where: { id: { in: [...new Set(enviados.map((e) => e.userId))] } },
    select: { id: true, lastLoginAt: true },
  });
  const ingreso = new Map(usuarios.map((u) => [u.id, u.lastLoginAt]));
  const entraron = enviados.filter((e) => {
    const l = ingreso.get(e.userId);
    return l != null && l.getTime() > e.createdAt.getTime();
  }).length;
  return `Mails: ${enviados.length} enviados; ${entraron} de esos fotógrafos entraron después.`;
}

/**
 * Fotógrafos cuyo primer pedido pagado (no de prueba, con monto) de toda su historia cayó en este mes argentino.
 * Ambas consultas devuelven fotógrafos distintos (no pedidos), así un vendedor con muchos pedidos
 * no desplaza a otros del tope.
 */
async function lineaPrimerasVentas(inicioMes: Date): Promise<string> {
  const pagado = { status: "PAID" as const, isTest: false, totalCents: { gt: 0 } };
  const delMes = await prisma.album.findMany({
    where: { orders: { some: { ...pagado, createdAt: { gte: inicioMes } } } },
    select: { userId: true },
    distinct: ["userId"],
    take: MAX_VENDEDORES,
  });
  const candidatos = delMes.map((a) => a.userId);
  if (candidatos.length === 0) return "Primeras ventas este mes: 0 fotógrafos.";
  const previos = await prisma.album.findMany({
    where: { userId: { in: candidatos }, orders: { some: { ...pagado, createdAt: { lt: inicioMes } } } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const yaVendian = new Set(previos.map((a) => a.userId));
  const nuevos = candidatos.filter((id) => !yaVendian.has(id)).length;
  return `Primeras ventas este mes: ${nuevos} fotógrafos.`;
}

/** Álbumes escolares recientes (acotado) cuyo paso 9, preventa publicada, está hecho. */
async function lineaEscolares(now: Date): Promise<string> {
  const albumes = await prisma.album.findMany({
    where: {
      deletedAt: null,
      isTest: false,
      createdAt: { gt: new Date(now.getTime() - VENTANA_ESCOLAR_DIAS * DIA_MS) },
      OR: [{ schoolId: { not: null } }, { mode: "SCHOOL" }],
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ALBUMES_ESCOLARES,
    select: { id: true, userId: true },
  });
  let publicadas = 0;
  for (const a of albumes) {
    try {
      const p = await computeSchoolSetupProgress(a.userId, a.id, now);
      if (p.pasos.some((x) => x.id === "preventa_publicada" && x.estado === "hecho")) publicadas++;
    } catch {
      // Un álbum que falla no tira el resumen entero.
    }
  }
  return `Álbumes escolares con preventa publicada: ${publicadas}.`;
}

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
  // Una consulta por lista de álbumes (sin un OR por álbum); el corte por álbum se hace acá.
  const earliest = new Date(Math.min(...[...firstChange.values()].map((d) => d.getTime())));
  const rows = await prisma.order.findMany({
    where: { ...PAID_SALE, albumId: { in: [...firstChange.keys()] }, createdAt: { gt: earliest } },
    select: { albumId: true, totalCents: true, createdAt: true },
  });
  const pesos = rows.reduce((sum, o) => (o.createdAt > firstChange.get(o.albumId)! ? sum + o.totalCents : sum), 0);
  return { albums: firstChange.size, pesos };
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
  const [total, byStatus, actions, incidents, month, salesNow, salesPrev, unlocked, saludos, mails, primeras, escolares] =
    await Promise.all([
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
    prisma.botOutreach.groupBy({
      by: ["campaign", "status"],
      where: { platform: BOT_PLATFORM, channel: "PANEL", createdAt: { gt: since } },
      _count: { _all: true },
    }),
    lineaMails(since),
    lineaPrimerasVentas(w.currentStart),
    lineaEscolares(now),
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
    primeras,
    lineaSaludos(saludos as FilaSaludo[]),
    mails,
    escolares,
    `Gasto del bot este mes: USD ${spent} de USD ${cap} (se factura en dólares).`,
    `Álbumes destrabados por el bot: ${unlocked.albums} (ventas desde que el bot los cambió: ${formatPurchaseArs(unlocked.pesos)}).`,
  ].join("\n");
}
