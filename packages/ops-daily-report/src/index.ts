/**
 * @repo/ops-daily-report — Informe Diario DNX.
 *
 * Lógica pura de recolección y armado. No importa Prisma ni proveedores de
 * correo: los datos entran por los puertos definidos en `contracts/ports`.
 */

export {
  REPORT_TIME_ZONE,
  resolveArgentinaDayWindow,
  type DateRange,
  type DayWindow,
} from "./window/day-window";

export * from "./contracts/index";

export { alertScore, rankAlerts } from "./alerts/rank";

export { runCollector, type Collector, type CollectorResult } from "./report/run-collector";

export { buildDailyReport, type BuildDailyReportInput } from "./report/build";

export { createClfMonorepoCollector, type ClfMonorepoOptions } from "./collectors/clf-monorepo";

export { createIncidentsCollector, type IncidentsOptions } from "./collectors/incidents";

export { createClickatonCollector, type ClickatonOptions } from "./collectors/clickaton";

export { createFotorankCollector, type FotorankOptions } from "./collectors/fotorank";

export { createInfoSpotCollector, type InfoSpotOptions } from "./collectors/infospot";

export { createFotofficeCollector, type FotofficeOptions } from "./collectors/fotoffice";

export {
  createFaceRecognitionCollector,
  type FaceRecognitionOptions,
} from "./collectors/face-recognition";
