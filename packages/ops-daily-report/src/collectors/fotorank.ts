import type { ReportAlert } from "../contracts/alert";
import { buildMetric } from "../contracts/metric";
import type { FotorankPort, FotorankRegistrationRow } from "../contracts/ports";
import type { ReportTable } from "../contracts/snapshot";
import type { Collector, CollectorResult } from "../report/run-collector";
import type { DayWindow } from "../window/day-window";

const SECTION_KEY = "fotorank";
const SECTION_TITLE = "FotoRank";
const RANKING_SIZE = 5;
/** A partir de acá la cola de revisión manual empieza a frenar el concurso. */
const AWAITING_REVIEW_THRESHOLD = 1;

export type FotorankOptions = {
  adminBaseUrl: string;
};

const CONFIRMED = "CONFIRMED";
const PENDING = "PENDING_PAYMENT";

type RegistrationsSummary = {
  confirmed: number;
  pending: number;
  revenueArs: number;
};

function summarize(rows: FotorankRegistrationRow[]): RegistrationsSummary {
  let confirmed = 0;
  let pending = 0;
  let revenueArs = 0;

  for (const row of rows) {
    if (row.status === CONFIRMED) {
      confirmed += 1;
      revenueArs += row.priceArs;
      continue;
    }
    if (row.status === PENDING) pending += 1;
  }

  return { confirmed, pending, revenueArs };
}

type ContestRank = {
  title: string;
  registrations: number;
  revenueArs: number;
};

function rankContests(rows: FotorankRegistrationRow[]): ContestRank[] {
  const buckets = new Map<string, ContestRank>();

  for (const row of rows) {
    if (row.status !== CONFIRMED) continue;
    const current = buckets.get(row.contestId) ?? {
      title: row.contestTitle,
      registrations: 0,
      revenueArs: 0,
    };
    current.registrations += 1;
    current.revenueArs += row.priceArs;
    buckets.set(row.contestId, current);
  }

  return [...buckets.values()]
    .sort(
      (left, right) =>
        right.registrations - left.registrations ||
        right.revenueArs - left.revenueArs ||
        left.title.localeCompare(right.title),
    )
    .slice(0, RANKING_SIZE);
}

function contestsTable(contests: ContestRank[]): ReportTable {
  return {
    title: "Ranking de concursos por inscripciones",
    columns: ["Concurso", "Inscripciones", "Facturación (ARS)"],
    rows: contests.map((contest) => [contest.title, contest.registrations, contest.revenueArs]),
    emptyMessage: "Sin inscripciones en el día.",
  };
}

export function createFotorankCollector(
  port: FotorankPort,
  window: DayWindow,
  options: FotorankOptions,
): Collector {
  return {
    key: SECTION_KEY,
    title: SECTION_TITLE,
    async run(): Promise<CollectorResult> {
      const [currentRows, previousRows, activity, previousActivity] = await Promise.all([
        port.registrations(window.current),
        port.registrations(window.previous),
        port.activity(window.current),
        port.activity(window.previous),
      ]);

      const current = summarize(currentRows);
      const previous = summarize(previousRows);

      const rejectedEntries = activity.entriesByStatus.REJECTED ?? 0;
      const alerts: ReportAlert[] = [];

      if (activity.entriesAwaitingReview >= AWAITING_REVIEW_THRESHOLD) {
        alerts.push({
          id: `${SECTION_KEY}:entries-awaiting-review`,
          platform: "fotorank",
          title: "Obras esperando revisión manual",
          detail:
            `${activity.entriesAwaitingReview} obras quedaron frenadas esperando una decisión ` +
            "manual. Mientras tanto no entran al circuito de jurado.",
          severity: "medium",
          urgency: "today",
          affectedCount: activity.entriesAwaitingReview,
          since: null,
          actionUrl: `${options.adminBaseUrl}/admin/obras`,
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
              title: "Inscripciones",
              metrics: [
                buildMetric({
                  key: "confirmedRegistrations",
                  label: "Inscripciones confirmadas",
                  value: current.confirmed,
                  format: "count",
                  previousValue: previous.confirmed,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "registrationRevenueArs",
                  label: "Facturación por inscripciones",
                  value: current.revenueArs,
                  format: "currencyArs",
                  previousValue: previous.revenueArs,
                  sevenDayAverage: null,
                  hint: "Los concursos gratuitos suman inscripciones sin sumar facturación.",
                }),
                buildMetric({
                  key: "pendingRegistrations",
                  label: "Inscripciones pendientes de pago",
                  value: current.pending,
                  format: "count",
                  previousValue: previous.pending,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "activeContests",
                  label: "Concursos activos",
                  value: activity.activeContests,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                }),
              ],
            },
            {
              title: "Obras y jurado",
              metrics: [
                buildMetric({
                  key: "entriesSubmitted",
                  label: "Obras recibidas",
                  value: activity.entriesSubmitted,
                  format: "count",
                  previousValue: previousActivity.entriesSubmitted,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "entriesAwaitingReview",
                  label: "Obras esperando revisión",
                  value: activity.entriesAwaitingReview,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "rejectedEntries",
                  label: "Obras rechazadas",
                  value: rejectedEntries,
                  format: "count",
                  previousValue: previousActivity.entriesByStatus.REJECTED ?? 0,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "juryVotes",
                  label: "Votos de jurado",
                  value: activity.juryVotes,
                  format: "count",
                  previousValue: previousActivity.juryVotes,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "activeJudges",
                  label: "Jurados activos",
                  value: activity.activeJudges,
                  format: "count",
                  previousValue: previousActivity.activeJudges,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "diplomasIssued",
                  label: "Diplomas emitidos",
                  value: activity.diplomasIssued,
                  format: "count",
                  previousValue: previousActivity.diplomasIssued,
                  sevenDayAverage: null,
                }),
              ],
            },
          ],
          tables: [contestsTable(rankContests(currentRows))],
        },
      };
    },
  };
}
