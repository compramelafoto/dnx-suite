import { rankAlerts } from "../alerts/rank";
import type { ReportAlert } from "../contracts/alert";
import type { DailyReportSnapshot, DailyReportStatus, ReportSection } from "../contracts/snapshot";
import type { DayWindow } from "../window/day-window";
import { runCollector, type Collector, type CollectorResult } from "./run-collector";

export type BuildDailyReportInput = {
  window: DayWindow;
  collectors: Collector[];
  /** Momento de generación; se inyecta para que los tests sean deterministas. */
  now: Date;
};

function resolveStatus(total: number, failed: number): DailyReportStatus {
  if (failed === 0) return "complete";
  if (failed >= total) return "failed";
  return "partial";
}

export async function buildDailyReport(
  input: BuildDailyReportInput,
): Promise<DailyReportSnapshot> {
  const startedAt = Date.now();

  // Los colectores corren de a uno. Comparten la misma base (y su límite de
  // conexiones): lanzados todos juntos suman ~30 consultas a la vez contra un
  // pool de 5, y con la base algo lenta se cortan por espera (pasó el 14/11/2026).
  // Si uno falla se reintenta una vez, por si el problema fue pasajero.
  const results: CollectorResult[] = [];
  for (const collector of input.collectors) {
    let result = await runCollector(collector);
    if (result.section.status === "failed") {
      result = await runCollector(collector);
    }
    results.push(result);
  }

  const sections: ReportSection[] = results.map((result) => result.section);
  const alerts: ReportAlert[] = results.flatMap((result) => result.alerts);
  const failedSections = sections
    .filter((section) => section.status === "failed")
    .map((section) => section.key);

  return {
    reportDate: input.window.reportDate,
    timeZone: input.window.timeZone,
    generatedAt: input.now.toISOString(),
    generationMs: Date.now() - startedAt,
    status: resolveStatus(sections.length, failedSections.length),
    sections,
    alerts: rankAlerts(alerts),
    failedSections,
  };
}
