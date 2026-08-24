/**
 * Traducción del informe a los bloques de texto que consume la plantilla de
 * correo. Vive en la app y no en `@repo/communications` para que el paquete de
 * comunicaciones no dependa de la forma del informe.
 */

import {
  PLATFORM_LABELS,
  URGENCY_LABELS,
  type ReportAlert,
  type ReportMetric,
  type ReportSection,
} from "@repo/ops-daily-report";

const numberFormatter = new Intl.NumberFormat("es-AR");

export function formatReportDate(reportDate: string): string {
  const [year, month, day] = reportDate.split("-");
  return `${day}/${month}/${year}`;
}

function formatValue(metric: ReportMetric): string {
  switch (metric.format) {
    case "currencyArs":
      return `${numberFormatter.format(metric.value)} ARS`;
    case "percent":
      return `${metric.value} %`;
    case "duration":
      return `${numberFormatter.format(metric.value)} ms`;
    default:
      return numberFormatter.format(metric.value);
  }
}

function formatChange(metric: ReportMetric): string {
  if (metric.changeRatio === null) return "";
  const percent = Math.round(metric.changeRatio * 100);
  const sign = percent > 0 ? "+" : "";
  return ` (${sign}${percent} % vs. ayer)`;
}

export function renderAlertsBlock(alerts: ReportAlert[]): string {
  if (alerts.length === 0) {
    return "No hay alertas para atender. Todo funcionó con normalidad.";
  }

  return alerts
    .map((alert) => {
      const count = alert.affectedCount === null ? "" : ` — ${alert.affectedCount} casos`;
      return [
        `[${URGENCY_LABELS[alert.urgency]}] ${PLATFORM_LABELS[alert.platform]}: ${alert.title}${count}`,
        alert.detail,
        alert.actionUrl ? `Resolver: ${alert.actionUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export function renderSummaryBlock(sections: ReportSection[]): string {
  const parts: string[] = [];

  for (const section of sections) {
    if (section.status === "failed") continue;

    // Sin mayúsculas forzadas: los nombres de marca llevan mayúsculas propias
    // ("ComprameLaFoto", "FotOffice") y convertirlos los arruina.
    const lines: string[] = [`── ${section.title} ──`];

    for (const group of section.groups) {
      lines.push(`  ${group.title}`);
      for (const metric of group.metrics) {
        lines.push(`    ${metric.label}: ${formatValue(metric)}${formatChange(metric)}`);
      }
    }

    for (const table of section.tables) {
      lines.push(`  ${table.title}`);
      if (table.rows.length === 0) {
        lines.push(`    ${table.emptyMessage}`);
        continue;
      }
      for (const row of table.rows) {
        lines.push(`    ${row.join(" · ")}`);
      }
    }

    parts.push(lines.join("\n"));
  }

  return parts.length > 0 ? parts.join("\n\n") : "No hubo datos para informar.";
}

export function renderFailedSectionsNote(sections: ReportSection[]): string | undefined {
  const failed = sections.filter((section) => section.status === "failed");
  if (failed.length === 0) return undefined;

  const names = failed.map((section) => section.title).join(", ");
  return `No se pudo obtener: ${names}. El resto del informe es válido.`;
}
