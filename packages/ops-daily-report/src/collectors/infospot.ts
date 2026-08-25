import type { ReportAlert } from "../contracts/alert";
import { buildMetric } from "../contracts/metric";
import type { InfoSpotPort } from "../contracts/ports";
import type { Collector, CollectorResult } from "../report/run-collector";
import type { DayWindow } from "../window/day-window";

const SECTION_KEY = "infospot";
const SECTION_TITLE = "Info Spot";

export type InfoSpotOptions = {
  adminBaseUrl: string;
};

export function createInfoSpotCollector(
  port: InfoSpotPort,
  window: DayWindow,
  options: InfoSpotOptions,
): Collector {
  return {
    key: SECTION_KEY,
    title: SECTION_TITLE,
    async run(): Promise<CollectorResult> {
      const [current, previous] = await Promise.all([
        port.stats(window.current),
        port.stats(window.previous),
      ]);

      const alerts: ReportAlert[] = [];

      // Cero lecturas es normal en un sitio recién lanzado; solo preocupa
      // cuando había notas publicadas o el día anterior sí tuvo tráfico.
      const shouldHaveTraffic = current.articlesPublished > 0 || previous.articleViews > 0;
      if (current.articleViews === 0 && shouldHaveTraffic) {
        alerts.push({
          id: `${SECTION_KEY}:no-views`,
          platform: "infospot",
          title: "Info Spot no registró ninguna lectura",
          detail:
            "No se contabilizó ni una vista de nota en todo el día, habiendo contenido publicado. " +
            "Puede ser una caída del sitio o una falla en el registro de métricas.",
          severity: "high",
          urgency: "immediate",
          affectedCount: null,
          since: null,
          actionUrl: `${options.adminBaseUrl}/admin`,
        });
      }

      return {
        alerts,
        section: {
          key: SECTION_KEY,
          title: SECTION_TITLE,
          status: "ok",
          error: null,
          groups: [
            {
              title: "Publicación",
              metrics: [
                buildMetric({
                  key: "articlesPublished",
                  label: "Notas publicadas",
                  value: current.articlesPublished,
                  format: "count",
                  previousValue: previous.articlesPublished,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "articlesInReview",
                  label: "Notas en revisión",
                  value: current.articlesInReview,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                  hint: "Esperando aprobación editorial.",
                }),
                buildMetric({
                  key: "newCoverages",
                  label: "Coberturas nuevas",
                  value: current.newCoverages,
                  format: "count",
                  previousValue: previous.newCoverages,
                  sevenDayAverage: null,
                }),
              ],
            },
            {
              title: "Audiencia",
              metrics: [
                buildMetric({
                  key: "articleViews",
                  label: "Lecturas de notas",
                  value: current.articleViews,
                  format: "count",
                  previousValue: previous.articleViews,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "clicksToClf",
                  label: "Clics hacia ComprameLaFoto",
                  value: current.clicksToClf,
                  format: "count",
                  previousValue: previous.clicksToClf,
                  sevenDayAverage: null,
                  hint: "Tráfico que Info Spot le deriva a la tienda.",
                }),
              ],
            },
          ],
          tables: [
            {
              title: "Notas más leídas",
              columns: ["Nota", "Lecturas"],
              rows: current.topArticles.map((article) => [article.title, article.views]),
              emptyMessage: "Sin lecturas registradas en el día.",
            },
          ],
        },
      };
    },
  };
}
