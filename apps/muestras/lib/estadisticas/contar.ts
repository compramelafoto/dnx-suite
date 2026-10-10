import "server-only";
import { prisma } from "@repo/db";
import { isBotUserAgent, isPrefetch, toArDay, type StatMetric } from "@repo/muestras";
import { getUsuario } from "@/lib/usuario";

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

/**
 * Quien organiza (o el super admin) mirando su propia muestra no cuenta. Sin cookie de sesión
 * `getUsuario` vuelve enseguida sin tocar la base: el caso del público no paga nada.
 */
export async function esDeQuienOrganiza(proposedByUserId: number): Promise<boolean> {
  const u = await getUsuario();
  return !!u && (u.esSuperAdmin || u.id === proposedByUserId);
}
