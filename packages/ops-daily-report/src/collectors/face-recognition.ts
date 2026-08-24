import type { ReportAlert } from "../contracts/alert";
import { buildMetric } from "../contracts/metric";
import type { FaceRecognitionPort, FaceRecognitionStats } from "../contracts/ports";
import type { Collector, CollectorResult } from "../report/run-collector";
import type { DayWindow } from "../window/day-window";

const SECTION_KEY = "face-recognition";
const SECTION_TITLE = "Reconocimiento facial";

/** Debajo de esta proporción de la tasa previa se considera degradación. */
const MATCH_RATE_DROP_THRESHOLD = 0.5;
/** Con menos búsquedas que esto, la tasa es ruido estadístico. */
const MIN_SEARCHES_FOR_RATE_ALERT = 10;

export type FaceRecognitionOptions = {
  adminBaseUrl: string;
};

function matchRate(stats: FaceRecognitionStats): number {
  if (stats.interestsWithSearch === 0) return 0;
  return Math.round((stats.interestsWithAnyMatch / stats.interestsWithSearch) * 100);
}

export function createFaceRecognitionCollector(
  port: FaceRecognitionPort,
  window: DayWindow,
  options: FaceRecognitionOptions,
): Collector {
  return {
    key: SECTION_KEY,
    title: SECTION_TITLE,
    async run(): Promise<CollectorResult> {
      const [current, previous, trailing] = await Promise.all([
        port.stats(window.current),
        port.stats(window.previous),
        port.stats(window.trailingSevenDays),
      ]);

      const currentRate = matchRate(current);
      const previousRate = matchRate(previous);
      const trailingRate = matchRate(trailing);

      const alerts: ReportAlert[] = [];

      if (
        current.interestsWithSearch >= MIN_SEARCHES_FOR_RATE_ALERT &&
        current.interestsWithAnyMatch === 0
      ) {
        alerts.push({
          id: `${SECTION_KEY}:no-matches`,
          platform: "clf-monorepo",
          title: "El reconocimiento facial no encontró ninguna coincidencia",
          detail:
            `Hubo ${current.interestsWithSearch} búsquedas por rostro y ninguna devolvió resultado. ` +
            "Puede ser una falla del servicio de reconocimiento o de la indexación de rostros.",
          severity: "high",
          urgency: "immediate",
          affectedCount: current.interestsWithSearch,
          since: null,
          actionUrl: `${options.adminBaseUrl}/admin/ia`,
        });
      } else if (
        current.interestsWithSearch >= MIN_SEARCHES_FOR_RATE_ALERT &&
        trailingRate > 0 &&
        currentRate < trailingRate * MATCH_RATE_DROP_THRESHOLD
      ) {
        alerts.push({
          id: `${SECTION_KEY}:match-rate-drop`,
          platform: "clf-monorepo",
          title: "Cayó la tasa de coincidencia del reconocimiento facial",
          detail:
            `La tasa bajó a ${currentRate} % cuando la última semana venía en ${trailingRate} %. ` +
            "Conviene revisar la calidad de indexación y los umbrales de similitud.",
          severity: "high",
          urgency: "today",
          affectedCount: current.interestsWithSearch,
          since: null,
          actionUrl: `${options.adminBaseUrl}/admin/ia`,
        });
      }

      if (current.photosAnalyzedError > 0) {
        alerts.push({
          id: `${SECTION_KEY}:analysis-errors`,
          platform: "clf-monorepo",
          title: "Análisis de fotos con error",
          detail:
            `${current.photosAnalyzedError} fotos terminaron con error en el análisis. ` +
            "Esas fotos no van a aparecer en las búsquedas por rostro.",
          severity: "medium",
          urgency: "today",
          affectedCount: current.photosAnalyzedError,
          since: null,
          actionUrl: `${options.adminBaseUrl}/admin/procesamiento-fotos`,
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
              title: "Búsquedas por rostro",
              metrics: [
                buildMetric({
                  key: "searches",
                  label: "Búsquedas realizadas",
                  value: current.interestsWithSearch,
                  format: "count",
                  previousValue: previous.interestsWithSearch,
                  sevenDayAverage: trailing.interestsWithSearch / 7,
                }),
                buildMetric({
                  key: "searchesWithMatch",
                  label: "Búsquedas con resultado",
                  value: current.interestsWithAnyMatch,
                  format: "count",
                  previousValue: previous.interestsWithAnyMatch,
                  sevenDayAverage: trailing.interestsWithAnyMatch / 7,
                }),
                buildMetric({
                  key: "matchRate",
                  label: "Tasa de coincidencia",
                  value: currentRate,
                  format: "percent",
                  previousValue: previousRate,
                  sevenDayAverage: trailingRate,
                  hint: "Porcentaje de búsquedas que devolvieron al menos una foto.",
                }),
                buildMetric({
                  key: "matchEvents",
                  label: "Coincidencias encontradas",
                  value: current.matchEvents,
                  format: "count",
                  previousValue: previous.matchEvents,
                  sevenDayAverage: trailing.matchEvents / 7,
                }),
              ],
            },
            {
              title: "Procesamiento",
              metrics: [
                buildMetric({
                  key: "analysisDone",
                  label: "Fotos analizadas",
                  value: current.photosAnalyzedDone,
                  format: "count",
                  previousValue: previous.photosAnalyzedDone,
                  sevenDayAverage: trailing.photosAnalyzedDone / 7,
                }),
                buildMetric({
                  key: "facesDetected",
                  label: "Rostros detectados",
                  value: current.facesDetected,
                  format: "count",
                  previousValue: previous.facesDetected,
                  sevenDayAverage: trailing.facesDetected / 7,
                }),
                buildMetric({
                  key: "analysisPending",
                  label: "Fotos en cola de análisis",
                  value: current.photosAnalyzedPending,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "analysisError",
                  label: "Análisis con error",
                  value: current.photosAnalyzedError,
                  format: "count",
                  previousValue: previous.photosAnalyzedError,
                  sevenDayAverage: null,
                }),
              ],
            },
          ],
          tables: [],
        },
      };
    },
  };
}
