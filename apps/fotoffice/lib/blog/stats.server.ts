import "server-only";
import { Prisma, prisma } from "@repo/db";
import { FOTOFFICE_BLOG_PLATFORM } from "./scope";
import { arDayRange, fillDays, periodStartUtc, type BlogStatsPeriod, type DayCount } from "./stats";

export type BlogStats = {
  period: BlogStatsPeriod;
  readers: number;
  reads: number;
  postsRead: number;
  byDay: DayCount[];
  topPosts: { id: number; title: string; slug: string; reads: number; totalReads: number }[];
  /** Primera lectura registrada del blog (cualquier período). null = nunca nadie leyó. */
  trackingSince: Date | null;
};

/**
 * Lee del registro de lecturas (`BlogPostView`), no del contador `viewCount`: el contador se
 * suma en segundo plano después de responder y a veces se pierde; la fila de la lectura no.
 *
 * Toda consulta filtra por la institución de la sesión. `viewedAt` es `timestamp` sin zona y
 * guarda UTC: para el día argentino hay que convertir dos veces (`AT TIME ZONE 'UTC'` y después
 * a Buenos Aires).
 */
export async function loadBlogStats(workspaceId: string, period: BlogStatsPeriod): Promise<BlogStats> {
  const since = periodStartUtc(period);
  const scope = Prisma.sql`p.platform = ${FOTOFFICE_BLOG_PLATFORM} AND p."workspaceKey" = ${workspaceId}`;

  const [totals, days, top, first] = await Promise.all([
    prisma.$queryRaw<{ reads: number; readers: number; posts: number }[]>`
      SELECT count(*)::int AS reads, count(DISTINCT v."visitorKey")::int AS readers, count(DISTINCT v."postId")::int AS posts
      FROM "BlogPostView" v JOIN "BlogPost" p ON p.id = v."postId"
      WHERE ${scope} AND v."viewedAt" >= ${since}::timestamp`,
    prisma.$queryRaw<{ day: string; reads: number }[]>`
      SELECT to_char((v."viewedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM-DD') AS day,
             count(*)::int AS reads
      FROM "BlogPostView" v JOIN "BlogPost" p ON p.id = v."postId"
      WHERE ${scope} AND v."viewedAt" >= ${since}::timestamp
      GROUP BY 1`,
    prisma.$queryRaw<{ id: number; title: string; slug: string; reads: number; totalReads: number }[]>`
      SELECT p.id, p.title, p.slug,
             count(*) FILTER (WHERE v."viewedAt" >= ${since}::timestamp)::int AS reads,
             count(*)::int AS "totalReads"
      FROM "BlogPostView" v JOIN "BlogPost" p ON p.id = v."postId"
      WHERE ${scope}
      GROUP BY p.id, p.title, p.slug
      HAVING count(*) FILTER (WHERE v."viewedAt" >= ${since}::timestamp) > 0
      ORDER BY reads DESC, "totalReads" DESC, p.title
      LIMIT 10`,
    prisma.$queryRaw<{ first: Date | null }[]>`
      SELECT min(v."viewedAt") AS first FROM "BlogPostView" v JOIN "BlogPost" p ON p.id = v."postId" WHERE ${scope}`,
  ]);

  const t = totals[0] ?? { reads: 0, readers: 0, posts: 0 };
  return {
    period,
    readers: t.readers,
    reads: t.reads,
    postsRead: t.posts,
    byDay: fillDays(arDayRange(period), days),
    topPosts: top,
    trackingSince: first[0]?.first ?? null,
  };
}
