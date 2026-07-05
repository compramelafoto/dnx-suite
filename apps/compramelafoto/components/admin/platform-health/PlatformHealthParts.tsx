"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import Card from "@/components/ui/Card";
import type { DailyCount, PlatformHealthSnapshot } from "@/lib/admin/platform-health";

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-AR");
  } catch {
    return iso;
  }
}

export function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

type MetricTone = "neutral" | "ok" | "info" | "warn" | "danger";

const toneText: Record<MetricTone, string> = {
  neutral: "text-gray-900",
  ok: "text-emerald-700",
  info: "text-blue-700",
  warn: "text-amber-700",
  danger: "text-red-700",
};

const toneBg: Record<MetricTone, string> = {
  neutral: "bg-gray-100 text-gray-600",
  ok: "bg-emerald-50 text-emerald-700",
  info: "bg-blue-50 text-blue-700",
  warn: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
};

export function MetricCard({
  label,
  value,
  description,
  tone = "neutral",
  icon,
  tooltip,
  href,
}: {
  label: string;
  value: string | number;
  description?: string;
  tone?: MetricTone;
  icon?: ReactNode;
  tooltip?: string;
  href?: string;
}) {
  const display =
    typeof value === "number" ? value.toLocaleString("es-AR") : value;

  const inner = (
    <Card
      className={`p-4 min-w-0 transition-transform hover:scale-[1.01] ${href ? "cursor-pointer" : ""}`}
      title={tooltip}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-gray-600 m-0">{label}</p>
          <p className={`text-2xl font-bold mt-1 m-0 tabular-nums ${toneText[tone]}`}>
            {display}
          </p>
          {description ? (
            <p className="text-xs text-gray-500 mt-1 m-0">{description}</p>
          ) : null}
        </div>
        {icon ? (
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${toneBg[tone]}`}
          >
            {icon}
          </span>
        ) : null}
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block min-w-0 no-underline text-inherit">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function ProgressBar({
  percent,
  label,
  tone = "blue",
}: {
  percent: number;
  label?: string;
  tone?: "blue" | "emerald" | "amber";
}) {
  const bar =
    tone === "emerald"
      ? "bg-emerald-600"
      : tone === "amber"
        ? "bg-amber-500"
        : "bg-[#c27b3d]";
  return (
    <div className="w-full">
      {label ? (
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>{label}</span>
          <span className="tabular-nums">{Math.min(100, Math.max(0, percent))}%</span>
        </div>
      ) : null}
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`${bar} h-2.5 rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
}

export function SectionHeader({
  id,
  title,
  subtitle,
}: {
  id?: string;
  title: string;
  subtitle?: ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold text-gray-900 m-0">{title}</h2>
      {subtitle ? <div className="text-sm text-gray-600 mt-1">{subtitle}</div> : null}
    </div>
  );
}

export function MiniBarChart({
  title,
  series,
  color = "#c27b3d",
}: {
  title: string;
  series: DailyCount[];
  color?: string;
}) {
  const max = Math.max(1, ...series.map((d) => d.count));
  return (
    <Card className="p-4 min-w-0">
      <p className="text-sm font-medium text-gray-800 m-0 mb-3">{title}</p>
      <div className="flex items-end gap-0.5 h-24">
        {series.map((point) => {
          const h = Math.max(2, Math.round((point.count / max) * 100));
          return (
            <div
              key={point.date}
              className="flex-1 min-w-0 group relative"
              title={`${point.date}: ${point.count.toLocaleString("es-AR")}`}
            >
              <div
                className="w-full rounded-t-sm opacity-80 group-hover:opacity-100 transition-opacity"
                style={{ height: `${h}%`, backgroundColor: color, minHeight: 2 }}
              />
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-gray-500 mt-2 m-0">Últimos 30 días</p>
    </Card>
  );
}

export function TopList({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; count: number }>;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <Card className="p-4 min-w-0">
      <p className="text-sm font-medium text-gray-800 m-0 mb-3">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 m-0">Sin datos aún.</p>
      ) : (
        <ul className="space-y-2 m-0 p-0 list-none">
          {items.map((item) => (
            <li key={item.label}>
              <div className="flex justify-between text-xs text-gray-700 gap-2">
                <span className="truncate" title={item.label}>
                  {item.label}
                </span>
                <span className="tabular-nums shrink-0 font-medium">
                  {item.count.toLocaleString("es-AR")}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                <div
                  className="bg-[#1e3a5f] h-1.5 rounded-full"
                  style={{ width: `${Math.round((item.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function AlertsBanner({ data }: { data: PlatformHealthSnapshot }) {
  if (data.alerts.length === 0) return null;
  return (
    <Card className="p-4 border-l-4 border-red-500 bg-red-50/80">
      <p className="text-sm font-semibold text-red-800 m-0 mb-2">Alertas activas</p>
      <ul className="space-y-2 m-0 p-0 list-none">
        {data.alerts.map((alert) => (
          <li key={alert.id} className="text-sm text-red-900">
            {alert.href ? (
              <Link href={alert.href} className="underline hover:text-red-700">
                ⚠ {alert.message}
              </Link>
            ) : (
              <span>⚠ {alert.message}</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function StatusBadge({
  status,
}: {
  status: "ok" | "degraded" | "offline" | "unknown";
}) {
  const map = {
    ok: { label: "Operativo", className: "bg-emerald-100 text-emerald-800" },
    degraded: { label: "Degradado", className: "bg-amber-100 text-amber-800" },
    offline: { label: "Sin respuesta", className: "bg-red-100 text-red-800" },
    unknown: { label: "Desconocido", className: "bg-gray-100 text-gray-700" },
  };
  const s = map[status];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}
