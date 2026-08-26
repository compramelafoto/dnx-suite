import { rankAlerts } from "../alerts/rank";
import type { ReportAlert } from "../contracts/alert";
import type { DailyReportSnapshot, DailyReportStatus, ReportSection } from "../contracts/snapshot";
import type { DayWindow } from "../window/day-window";
import { runCollector, type Collector } from "./run-collector";

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

  // Los colectores no dependen entre sí, así que corren en paralelo.
  const results = await Promise.all(input.collectors.map((collector) => runCollector(collector)));

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
