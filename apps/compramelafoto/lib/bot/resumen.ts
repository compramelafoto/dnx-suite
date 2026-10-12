import { BOT_PLATFORM } from "@/lib/bot/config";
import { argentinaDay, argentinaMonthPrefix } from "@/lib/bot/dia-argentino";
import { prisma } from "@/lib/prisma";

export async function buildDailySummary(now: Date): Promise<string> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const where = { platform: BOT_PLATFORM, createdAt: { gt: since } };
  const [total, byStatus, actions, incidents, month] = await Promise.all([
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
    `Gasto del mes en la API de Claude: USD ${usd} (se factura en dólares).`,
  ].join("\n");
}
