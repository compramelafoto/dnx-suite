import { BOT_PLATFORM } from "@/lib/bot/config";
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

/** Fotógrafos cuyo primer pedido pagado (no de prueba, con monto) de toda su historia cayó en este mes argentino. */
async function lineaPrimerasVentas(now: Date): Promise<string> {
  const inicioMes = new Date(`${argentinaMonthPrefix(now)}-01T00:00:00-03:00`);
  const delMes = await prisma.order.findMany({
    where: { status: "PAID", isTest: false, totalCents: { gt: 0 }, createdAt: { gte: inicioMes } },
    select: { album: { select: { userId: true } } },
    take: MAX_VENDEDORES,
  });
  const candidatos = [...new Set(delMes.map((o) => o.album.userId))];
  if (candidatos.length === 0) return "Primeras ventas este mes: 0 fotógrafos.";
  const previos = await prisma.order.findMany({
    where: {
      status: "PAID",
      isTest: false,
      totalCents: { gt: 0 },
      createdAt: { lt: inicioMes },
      album: { userId: { in: candidatos } },
    },
    select: { album: { select: { userId: true } } },
    take: MAX_VENDEDORES * 4,
  });
  const yaVendian = new Set(previos.map((o) => o.album.userId));
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

export async function buildDailySummary(now: Date): Promise<string> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const where = { platform: BOT_PLATFORM, createdAt: { gt: since } };
  const [total, byStatus, actions, incidents, month, saludos, mails, primeras, escolares] = await Promise.all([
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
    prisma.botOutreach.groupBy({
      by: ["campaign", "status"],
      where: { platform: BOT_PLATFORM, channel: "PANEL", createdAt: { gt: since } },
      _count: { _all: true },
    }),
    lineaMails(since),
    lineaPrimerasVentas(now),
    lineaEscolares(now),
  ]);
  const esc = byStatus.find((s) => s.status === "ESCALATED")?._count._all ?? 0;
  const done = actions.find((s) => s.status === "EXECUTED")?._count._all ?? 0;
  const failed = actions.find((s) => s.status === "FAILED")?._count._all ?? 0;
  // La factura de la API de Claude es genuinamente en dólares (no son pesos).
  const usd = ((month._sum.costMicroUsd ?? 0) / 1_000_000).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return [
    `🤖 DNX Bot · CLF · resumen al ${argentinaDay(now)}`,
    `${total} conversaciones, ${total - esc} resueltas sin ticket, ${esc} derivadas.`,
    `${done} acciones hechas${failed ? `, ${failed} fallidas` : ""}.`,
    incidents.length
      ? `Errores del sistema:\n${incidents.map((i) => `- ${i.urgent ? "🚨 " : ""}${i.title} (×${i.occurrences})`).join("\n")}`
      : "Sin errores del sistema.",
    lineaSaludos(saludos as FilaSaludo[]),
    mails,
    primeras,
    escolares,
    `Gasto del mes en la API de Claude: USD ${usd} (se factura en dólares).`,
  ].join("\n");
}
