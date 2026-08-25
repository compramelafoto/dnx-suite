import type { ReportAlert } from "../contracts/alert";
import { buildMetric } from "../contracts/metric";
import type { FotofficePort } from "../contracts/ports";
import type { Collector, CollectorResult } from "../report/run-collector";
import type { DayWindow } from "../window/day-window";

const SECTION_KEY = "fotoffice";
const SECTION_TITLE = "FotOffice";

export type FotofficeOptions = {
  adminBaseUrl: string;
};

export function createFotofficeCollector(
  port: FotofficePort,
  window: DayWindow,
  options: FotofficeOptions,
): Collector {
  return {
    key: SECTION_KEY,
    title: SECTION_TITLE,
    async run(): Promise<CollectorResult> {
      const [current, previous] = await Promise.all([
        port.stats(window.current),
        port.stats(window.previous),
      ]);

      const totalNewLeads = current.newServiceLeads + current.newCourseLeads;
      const previousNewLeads = previous.newServiceLeads + previous.newCourseLeads;

      const alerts: ReportAlert[] = [];

      if (current.pendingLeads > 0) {
        alerts.push({
          id: `${SECTION_KEY}:pending-leads`,
          platform: "fotoffice",
          title: "Consultas sin responder",
          detail:
            `Hay ${current.pendingLeads} consultas de clientes todavía sin atender. ` +
            "Cada una es una venta posible que se enfría con el tiempo.",
          severity: "medium",
          urgency: "today",
          affectedCount: current.pendingLeads,
          since: null,
          actionUrl: `${options.adminBaseUrl}/dashboard`,
        });
      }

      const modules = Object.entries(current.enabledModules).sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      );

      return {
        alerts,
        section: {
          key: SECTION_KEY,
          title: SECTION_TITLE,
          status: "ok",
          error: null,
          groups: [
            {
              title: "Espacios y socios",
              metrics: [
                buildMetric({
                  key: "newWorkspaces",
                  label: "Espacios nuevos",
                  value: current.newWorkspaces,
                  format: "count",
                  previousValue: previous.newWorkspaces,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "totalWorkspaces",
                  label: "Espacios totales",
                  value: current.totalWorkspaces,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "newMembers",
                  label: "Socios nuevos",
                  value: current.newMembers,
                  format: "count",
                  previousValue: previous.newMembers,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "totalMembers",
                  label: "Socios totales",
                  value: current.totalMembers,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                }),
              ],
            },
            {
              title: "Consultas de clientes",
              metrics: [
                buildMetric({
                  key: "totalNewLeads",
                  label: "Consultas nuevas",
                  value: totalNewLeads,
                  format: "count",
                  previousValue: previousNewLeads,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "newServiceLeads",
                  label: "Consultas de servicios",
                  value: current.newServiceLeads,
                  format: "count",
                  previousValue: previous.newServiceLeads,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "newCourseLeads",
                  label: "Consultas de cursos",
                  value: current.newCourseLeads,
                  format: "count",
                  previousValue: previous.newCourseLeads,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "pendingLeads",
                  label: "Consultas sin atender",
                  value: current.pendingLeads,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                  hint: "Acumuladas, sin importar cuándo llegaron.",
                }),
                buildMetric({
                  key: "publishedWebsites",
                  label: "Sitios web publicados",
                  value: current.publishedWebsites,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                }),
              ],
            },
          ],
          tables: [
            {
              title: "Uso de módulos",
              columns: ["Módulo", "Espacios que lo tienen activo"],
              rows: modules.map(([name, count]) => [name, count]),
              emptyMessage: "Sin módulos habilitados.",
            },
          ],
        },
      };
    },
  };
}
