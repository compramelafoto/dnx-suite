/**
 * Adaptador Prisma del puerto de Info Spot.
 *
 * Las vistas no se cuentan evento por evento: Info Spot ya las agrega por día
 * en `InfoSpotContentMetricDaily`, con la fecha en columna DATE. Por eso esta
 * consulta usa el día calendario y no el rango de instantes.
 */

import type { PrismaClient } from "@prisma/client";
import type { DateRange, InfoSpotPort, InfoSpotStats } from "@repo/ops-daily-report";

const TOP_ARTICLES = 5;

/** Tipos de clic que derivan tráfico hacia ComprameLaFoto. */
const CLF_CLICK_KINDS = ["CLF_REGISTRATION_CLICK", "ALBUM_CLICK", "PURCHASE_CLICK"] as const;

/**
 * Fecha en formato YYYY-MM-DD del día argentino que cubre el rango.
 * El inicio del rango es la medianoche local, así que basta con leerlo en la
 * zona correspondiente.
 */
function dayKeyOf(range: DateRange): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = formatter.format(range.start).split("-").map(Number);
  // La columna es DATE, sin hora: se compara contra medianoche UTC.
  return new Date(Date.UTC(year!, month! - 1, day!));
}

export function createPrismaInfoSpotPort(client: PrismaClient): InfoSpotPort {
  return {
    async stats(range: DateRange): Promise<InfoSpotStats> {
      const inRange = { gte: range.start, lt: range.end };
      const day = dayKeyOf(range);

      const [articlesPublished, articlesInReview, newCoverages, viewRows, clickRows] =
        await Promise.all([
          client.infoSpotArticle.count({
            where: { status: "PUBLISHED", publishedAt: inRange },
          }),
          client.infoSpotArticle.count({ where: { status: "IN_REVIEW" } }),
          client.infoSpotCoverage.count({ where: { createdAt: inRange } }),
          client.infoSpotContentMetricDaily.findMany({
            where: { day, kind: "ARTICLE_VIEW" },
            select: { count: true, articleId: true },
          }),
          client.infoSpotContentMetricDaily.findMany({
            where: { day, kind: { in: [...CLF_CLICK_KINDS] } },
            select: { count: true },
          }),
        ]);

      const articleViews = viewRows.reduce((total, row) => total + row.count, 0);
      const clicksToClf = clickRows.reduce((total, row) => total + row.count, 0);

      // Solo se resuelven los títulos de las notas que entran al top.
      const topRows = [...viewRows]
        .filter((row) => row.articleId !== null)
        .sort((left, right) => right.count - left.count)
        .slice(0, TOP_ARTICLES);

      const titles =
        topRows.length > 0
          ? await client.infoSpotArticle.findMany({
              where: { id: { in: topRows.map((row) => row.articleId as string) } },
              select: { id: true, title: true },
            })
          : [];
      const titleById = new Map(titles.map((article) => [article.id, article.title]));

      return {
        articlesPublished,
        articlesInReview,
        articleViews,
        topArticles: topRows.map((row) => ({
          title: titleById.get(row.articleId as string) ?? "Nota sin título",
          views: row.count,
        })),
        newCoverages,
        clicksToClf,
      };
    },
  };
}
