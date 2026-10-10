import "server-only";
import { prisma } from "@repo/db";
import { isBotUserAgent, isPrefetch, toArDay, type StatMetric } from "@repo/muestras";

/**
 * Suma uno al contador del día (hora argentina). `INSERT … ON CONFLICT` es atómico: dos visitas
 * en el mismo instante nunca chocan (un `upsert` de Prisma puede fallar con P2002). Sólo
 * parámetros de texto: nada de números que Prisma mande como bigint.
 */
export async function sumarUno(c: { activityId: string; workId: string; metric: StatMetric; ahora?: Date }) {
  const day = toArDay(c.ahora ?? new Date());
  await prisma.$executeRaw`INSERT INTO "CulturalActivityDailyStat" ("activityId", "workId", "day", "metric", "count")
    VALUES (${c.activityId}, ${c.workId}, ${day}, ${c.metric}, 1)
    ON CONFLICT ("activityId", "workId", "day", "metric") DO UPDATE SET "count" = "CulturalActivityDailyStat"."count" + 1`;
}

/** Ni robots ni precargas. */
export function pedidoContable(h: Headers): boolean {
  return !isBotUserAgent(h.get("user-agent")) && !isPrefetch(h);
}

// Quién no cuenta (dueño, equipo o super admin) lo decide `esDelEquipo` de `lib/equipo/permisos`
// (etapa 5, D10).
