import type { ReportAlert } from "./alert";
import type { ReportMetric } from "./metric";

export type MetricGroup = {
  title: string;
  metrics: ReportMetric[];
};

export type ReportTable = {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  /** Qué mostrar cuando no hubo datos ese día. */
  emptyMessage: string;
};

export type ReportSection = {
  key: string;
  title: string;
  status: "ok" | "failed";
  /** Mensaje del error cuando status es "failed"; null si salió bien. */
  error: string | null;
  groups: MetricGroup[];
  tables: ReportTable[];
};

export type DailyReportStatus = "complete" | "partial" | "failed";

export type DailyReportSnapshot = {
  reportDate: string;
  timeZone: string;
  generatedAt: string;
  generationMs: number;
  status: DailyReportStatus;
  sections: ReportSection[];
  /** Ya ordenadas por urgencia y gravedad. */
  alerts: ReportAlert[];
  /** Claves de las secciones que fallaron. */
  failedSections: string[];
};
