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

// ─────────────────────────────────────────────────────────────────
// Versión HTML
//
// El correo no puede usar texto con sangrías: los clientes de correo lo
// comprimen y queda apilado e ilegible. Acá se arma HTML con tablas reales,
// que es lo único que renderiza parejo en Gmail, Outlook y el celular.
//
// Los colores espejan la marca `dnx` de @repo/communications.
// ─────────────────────────────────────────────────────────────────

const COLORS = {
  text: "#fafafa",
  muted: "#a1a1a1",
  border: "#262626",
  surface: "#141414",
  raised: "#1c1c1c",
  gold: "#d4af37",
  critical: "#f87171",
  high: "#fb923c",
  medium: "#fbbf24",
  low: "#a1a1a1",
} as const;

const URGENCY_COLOR: Record<ReportAlert["severity"], string> = {
  critical: COLORS.critical,
  high: COLORS.high,
  medium: COLORS.medium,
  low: COLORS.low,
};

const FONT = "Arial,Helvetica,sans-serif";

/** Escapa texto que viene de la base (nombres de fotógrafos, títulos, etc.). */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Solo se permiten enlaces http(s); cualquier otra cosa se descarta. */
function safeUrl(value: string | undefined): string | null {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return null;
  return esc(value);
}

export function renderAlertsHtml(alerts: ReportAlert[]): string {
  if (alerts.length === 0) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;"><tr><td style="padding:16px 18px;background-color:${COLORS.raised};border-left:4px solid #4ade80;border-radius:0 6px 6px 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${COLORS.text};">No hay alertas para atender. Todo funcionó con normalidad.</td></tr></table>`;
  }

  return alerts
    .map((alert) => {
      const color = URGENCY_COLOR[alert.severity];
      const count =
        alert.affectedCount === null
          ? ""
          : ` &middot; ${numberFormatter.format(alert.affectedCount)} ${
              alert.affectedCount === 1 ? "caso" : "casos"
            }`;
      const url = safeUrl(alert.actionUrl);

      const action = url
        ? `<div style="margin-top:12px;"><a href="${url}" target="_blank" rel="noopener noreferrer" style="font-family:${FONT};font-size:14px;font-weight:700;color:${COLORS.gold};text-decoration:none;">Ir a resolverlo &rarr;</a></div>`
        : "";

      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px 0;"><tr><td style="padding:16px 18px;background-color:${COLORS.raised};border-left:4px solid ${color};border-radius:0 6px 6px 0;">
<div style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${color};">${esc(URGENCY_LABELS[alert.urgency])} &middot; ${esc(PLATFORM_LABELS[alert.platform])}${count}</div>
<div style="font-family:${FONT};font-size:17px;font-weight:700;line-height:1.35;color:${COLORS.text};margin-top:8px;">${esc(alert.title)}</div>
<div style="font-family:${FONT};font-size:14px;line-height:1.6;color:${COLORS.muted};margin-top:8px;">${esc(alert.detail)}</div>
${action}
</td></tr></table>`;
    })
    .join("\n");
}

function metricRowHtml(metric: ReportMetric, isLast: boolean): string {
  const border = isLast ? "none" : `1px solid ${COLORS.border}`;
  let change = "";

  if (metric.changeRatio !== null) {
    const percent = Math.round(metric.changeRatio * 100);
    if (percent !== 0) {
      // Flecha sin color de juicio: subir no siempre es bueno (por ejemplo,
      // "fotos rechazadas" o "inscripciones caídas").
      const arrow = percent > 0 ? "&#9650;" : "&#9660;";
      change = ` <span style="font-family:${FONT};font-size:12px;font-weight:400;color:${COLORS.muted};white-space:nowrap;">${arrow} ${Math.abs(percent)}%</span>`;
    }
  }

  return `<tr>
<td style="padding:10px 0;border-bottom:${border};font-family:${FONT};font-size:14px;line-height:1.4;color:${COLORS.muted};">${esc(metric.label)}</td>
<td align="right" style="padding:10px 0 10px 12px;border-bottom:${border};font-family:${FONT};font-size:15px;font-weight:700;line-height:1.4;color:${COLORS.text};white-space:nowrap;">${esc(formatValue(metric))}${change}</td>
</tr>`;
}

function tableHtml(table: ReportSection["tables"][number]): string {
  const title = `<div style="font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:${COLORS.gold};margin:20px 0 10px 0;">${esc(table.title)}</div>`;

  if (table.rows.length === 0) {
    return `${title}<div style="font-family:${FONT};font-size:14px;line-height:1.5;color:${COLORS.muted};">${esc(table.emptyMessage)}</div>`;
  }

  const head = table.columns
    .map(
      (column, index) =>
        `<th align="${index === 0 ? "left" : "right"}" style="padding:8px 0;border-bottom:1px solid ${COLORS.border};font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${COLORS.muted};">${esc(column)}</th>`,
    )
    .join("");

  const body = table.rows
    .map((row) => {
      const cells = row
        .map((cell, index) => {
          const value = typeof cell === "number" ? numberFormatter.format(cell) : String(cell);
          return `<td align="${index === 0 ? "left" : "right"}" style="padding:9px 0;border-bottom:1px solid ${COLORS.border};font-family:${FONT};font-size:14px;line-height:1.4;color:${COLORS.text};">${esc(value)}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `${title}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function sectionHtml(section: ReportSection): string {
  const header = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 4px 0;"><tr><td style="border-top:2px solid ${COLORS.gold};padding-top:14px;"><span style="font-family:${FONT};font-size:19px;font-weight:700;color:${COLORS.text};">${esc(section.title)}</span></td></tr></table>`;

  if (section.status === "failed") {
    return `${header}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 0 0;"><tr><td style="padding:14px 16px;background-color:${COLORS.raised};border-left:4px solid ${COLORS.high};border-radius:0 6px 6px 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${COLORS.muted};"><strong style="color:${COLORS.high};">Sección no disponible.</strong><br />${esc(section.error ?? "Motivo desconocido.")}</td></tr></table>`;
  }

  const groups = section.groups
    .map((group) => {
      const rows = group.metrics
        .map((metric, index) => metricRowHtml(metric, index === group.metrics.length - 1))
        .join("");
      return `<div style="font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:${COLORS.gold};margin:18px 0 6px 0;">${esc(group.title)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`;
    })
    .join("");

  const tables = section.tables.map(tableHtml).join("");

  return `${header}${groups}${tables}`;
}

export function renderSummaryHtml(sections: ReportSection[]): string {
  if (sections.length === 0) {
    return `<div style="font-family:${FONT};font-size:15px;color:${COLORS.muted};">No hubo datos para informar.</div>`;
  }
  return sections.map(sectionHtml).join("\n");
}
