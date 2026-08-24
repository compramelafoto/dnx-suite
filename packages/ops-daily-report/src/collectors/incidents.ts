import type { ReportAlert } from "../contracts/alert";
import { buildMetric, type ReportMetric } from "../contracts/metric";
import type { IncidentsPort } from "../contracts/ports";
import type { Collector, CollectorResult } from "../report/run-collector";
import type { DayWindow } from "../window/day-window";

const SECTION_KEY = "incidents";
const SECTION_TITLE = "Incidentes técnicos";

/** A partir de acá una cola de correos deja de ser demora y pasa a ser traba. */
const EMAIL_QUEUE_STUCK_HOURS = 2;
/** Un pago acreditado sin conciliar después de esto es plata en riesgo. */
const UNRECONCILED_HOURS = 24;

export type IncidentsOptions = {
  adminBaseUrl: string;
  /** Momento de generación, para medir antigüedad. */
  now: Date;
};

function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (60 * 60 * 1000);
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function createIncidentsCollector(
  port: IncidentsPort,
  _window: DayWindow,
  options: IncidentsOptions,
): Collector {
  return {
    key: SECTION_KEY,
    title: SECTION_TITLE,
    async run(): Promise<CollectorResult> {
      const [emailQueue, unreconciled, fraud, jobs] = await Promise.all([
        port.emailQueue(),
        port.unreconciledPaidOrders(UNRECONCILED_HOURS),
        port.openFraudAlerts(),
        port.jobHealth(),
      ]);

      const alerts: ReportAlert[] = [];

      const queueAgeHours = emailQueue.oldestPendingAt
        ? hoursBetween(emailQueue.oldestPendingAt, options.now)
        : 0;

      if (emailQueue.pending > 0 && queueAgeHours >= EMAIL_QUEUE_STUCK_HOURS) {
        alerts.push({
          id: "incidents:email-queue-stuck",
          platform: "platform",
          title: "La cola de correos está trabada",
          detail:
            `Hay ${emailQueue.pending} correos sin enviar, el más viejo espera hace ` +
            `${Math.round(queueAgeHours)} horas. Los clientes no están recibiendo sus enlaces de descarga.`,
          severity: "critical",
          urgency: "immediate",
          affectedCount: emailQueue.pending,
          since: toIso(emailQueue.oldestPendingAt),
          actionUrl: `${options.adminBaseUrl}/admin/emails`,
        });
      }

      if (unreconciled.count > 0) {
        alerts.push({
          id: "incidents:unreconciled-payments",
          platform: "platform",
          title: "Pagos acreditados sin conciliar",
          detail:
            `${unreconciled.count} pedidos figuran pagados pero no terminaron de conciliarse ` +
            `hace más de ${UNRECONCILED_HOURS} horas. Puede haber plata cobrada sin entregar.`,
          severity: "critical",
          urgency: "immediate",
          affectedCount: unreconciled.count,
          since: toIso(unreconciled.oldestAt),
          actionUrl: `${options.adminBaseUrl}/admin/pagos-mp-anomalias`,
        });
      }

      if (fraud.count > 0) {
        alerts.push({
          id: "incidents:fraud-open",
          platform: "platform",
          title: "Alertas de fraude sin revisar",
          detail: `Hay ${fraud.count} alertas de fraude abiertas esperando revisión.`,
          severity: "high",
          urgency: "today",
          affectedCount: fraud.count,
          since: toIso(fraud.oldestAt),
          actionUrl: `${options.adminBaseUrl}/admin/antifraude`,
        });
      }

      for (const job of jobs) {
        if (job.stuck <= 0) continue;
        alerts.push({
          id: `incidents:job-stuck:${slugify(job.label)}`,
          platform: "platform",
          title: `Trabajos trabados: ${job.label}`,
          detail: `${job.stuck} trabajos de "${job.label}" quedaron tomados sin avanzar.`,
          severity: "medium",
          urgency: "today",
          affectedCount: job.stuck,
          since: toIso(job.oldestPendingAt),
          actionUrl: `${options.adminBaseUrl}/admin/salud-plataforma`,
        });
      }

      const jobMetrics: ReportMetric[] = jobs.flatMap((job) => [
        buildMetric({
          key: `job:${slugify(job.label)}:pending`,
          label: `${job.label} — pendientes`,
          value: job.pending,
          format: "count",
          previousValue: null,
          sevenDayAverage: null,
        }),
        buildMetric({
          key: `job:${slugify(job.label)}:failed`,
          label: `${job.label} — con error`,
          value: job.failed,
          format: "count",
          previousValue: null,
          sevenDayAverage: null,
        }),
      ]);

      return {
        alerts,
        section: {
          key: SECTION_KEY,
          title: SECTION_TITLE,
          status: "ok",
          error: null,
          groups: [
            {
              title: "Correos y pagos",
              metrics: [
                buildMetric({
                  key: "emailQueuePending",
                  label: "Correos pendientes de envío",
                  value: emailQueue.pending,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "emailQueueFailed",
                  label: "Correos con error",
                  value: emailQueue.failed,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "unreconciledPayments",
                  label: "Pagos sin conciliar",
                  value: unreconciled.count,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "openFraudAlerts",
                  label: "Alertas de fraude abiertas",
                  value: fraud.count,
                  format: "count",
                  previousValue: null,
                  sevenDayAverage: null,
                }),
              ],
            },
            ...(jobMetrics.length > 0
              ? [{ title: "Trabajos en segundo plano", metrics: jobMetrics }]
              : []),
          ],
          tables: [],
        },
      };
    },
  };
}
