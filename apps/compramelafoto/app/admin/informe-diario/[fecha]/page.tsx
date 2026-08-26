import Link from "next/link";
import { notFound } from "next/navigation";

import { findDailyReportSnapshot } from "@repo/db/daily-report-repository";
import {
  PLATFORM_LABELS,
  SEVERITY_LABELS,
  URGENCY_LABELS,
  type ReportAlert,
  type ReportMetric,
  type ReportSection,
} from "@repo/ops-daily-report";

import { prisma } from "@/lib/prisma";
import { formatReportDate } from "@/lib/daily-report/render-blocks";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("es-AR");

const SEVERITY_STYLES: Record<ReportAlert["severity"], string> = {
  critical: "border-red-300 bg-red-50",
  high: "border-orange-300 bg-orange-50",
  medium: "border-amber-300 bg-amber-50",
  low: "border-gray-300 bg-gray-50",
};

const SEVERITY_BADGES: Record<ReportAlert["severity"], string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-gray-400 text-white",
};

function formatValue(metric: ReportMetric): string {
  switch (metric.format) {
    case "currencyArs":
      return `$ ${numberFormatter.format(metric.value)}`;
    case "percent":
      return `${metric.value} %`;
    case "duration":
      return `${numberFormatter.format(metric.value)} ms`;
    default:
      return numberFormatter.format(metric.value);
  }
}

function ChangeBadge({ metric }: { metric: ReportMetric }) {
  if (metric.changeRatio === null) return null;

  const percent = Math.round(metric.changeRatio * 100);
  if (percent === 0) {
    return <span className="text-xs text-gray-500">igual que ayer</span>;
  }

  const isUp = percent > 0;
  return (
    <span className={`text-xs font-medium ${isUp ? "text-emerald-700" : "text-red-700"}`}>
      {isUp ? "▲" : "▼"} {Math.abs(percent)} % vs. ayer
    </span>
  );
}

function MetricCard({ metric }: { metric: ReportMetric }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs text-gray-500">{metric.label}</div>
      <div className="mt-1 text-xl font-semibold text-gray-900">{formatValue(metric)}</div>
      <div className="mt-1">
        <ChangeBadge metric={metric} />
      </div>
      {metric.hint ? <div className="mt-2 text-xs text-gray-500">{metric.hint}</div> : null}
    </div>
  );
}

function AlertCard({ alert }: { alert: ReportAlert }) {
  return (
    <div className={`rounded-lg border p-4 ${SEVERITY_STYLES[alert.severity]}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${SEVERITY_BADGES[alert.severity]}`}
        >
          {URGENCY_LABELS[alert.urgency]}
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
          {PLATFORM_LABELS[alert.platform]}
        </span>
        <span className="text-xs text-gray-500">Gravedad {SEVERITY_LABELS[alert.severity]}</span>
        {alert.affectedCount !== null ? (
          <span className="text-xs text-gray-500">· {alert.affectedCount} casos</span>
        ) : null}
      </div>
      <h3 className="mt-2 text-base font-semibold text-gray-900">{alert.title}</h3>
      <p className="mt-1 text-sm text-gray-700">{alert.detail}</p>
      {alert.actionUrl ? (
        <a href={alert.actionUrl} className="mt-2 inline-block text-sm text-[#c27b3d] underline">
          Ir a resolverlo
        </a>
      ) : null}
    </div>
  );
}

function SectionBlock({ section }: { section: ReportSection }) {
  if (section.status === "failed") {
    return (
      <section className="rounded-lg border border-red-200 bg-red-50 p-4">
        <h2 className="text-lg font-semibold text-gray-900 m-0">{section.title}</h2>
        <p className="mt-1 text-sm text-red-800">
          No se pudieron obtener los datos de esta sección: {section.error}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 m-0">{section.title}</h2>

      {section.groups.map((group) => (
        <div key={group.title} className="space-y-2">
          <h3 className="text-sm font-medium text-gray-600 m-0">{group.title}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {group.metrics.map((metric) => (
              <MetricCard key={metric.key} metric={metric} />
            ))}
          </div>
        </div>
      ))}

      {section.tables.map((table) => (
        <div key={table.title} className="space-y-2">
          <h3 className="text-sm font-medium text-gray-600 m-0">{table.title}</h3>
          {table.rows.length === 0 ? (
            <p className="text-sm text-gray-500 m-0">{table.emptyMessage}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    {table.columns.map((column) => (
                      <th key={column} className="px-4 py-2 font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {table.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-2 text-gray-800">
                          {typeof cell === "number" ? numberFormatter.format(cell) : cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

export default async function InformeDiarioDetallePage({
  params,
}: {
  params: Promise<{ fecha: string }>;
}) {
  const { fecha } = await params;
  const snapshot = await findDailyReportSnapshot(prisma, fecha);

  if (!snapshot) {
    notFound();
  }

  return (
    <div className="space-y-6 ds-dashboard-inner mx-auto w-full min-w-0">
      <div>
        <Link href="/admin/informe-diario" className="text-sm text-[#c27b3d] underline">
          ← Volver al listado
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 m-0">
          Informe del {formatReportDate(snapshot.reportDate)}
        </h1>
        <p className="text-xs text-gray-500 mt-2 m-0">
          Generado el {new Date(snapshot.generatedAt).toLocaleString("es-AR")} · tardó{" "}
          {numberFormatter.format(snapshot.generationMs)} ms · hora de {snapshot.timeZone}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 m-0">Requiere tu atención</h2>
        {snapshot.alerts.length === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            No hay alertas para atender. Todo funcionó con normalidad.
          </div>
        ) : (
          snapshot.alerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)
        )}
      </section>

      {snapshot.sections.map((section) => (
        <SectionBlock key={section.key} section={section} />
      ))}
    </div>
  );
}
