"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  computeOrdersAnalyticsSnapshot,
  formatAnalyticsMoney,
  formatAnalyticsPct,
  type OrdersRankingRow,
} from "./orders-analytics-helpers";
import type { PhotographerOrderRow } from "./photographer-order-types";

type OrdersAnalyticsWorkspaceProps = {
  orders: PhotographerOrderRow[];
  className?: string;
};

const CHART_HEIGHT = 192;
const CHART_TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid #f1f5f9",
  fontSize: 11,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

function KpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="flex min-h-[84px] flex-col justify-between rounded-lg border border-gray-100 bg-white p-3 min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-gray-400 leading-tight">{label}</p>
      <div className="mt-2">
        <p className={cn("text-xl font-semibold leading-none tabular-nums", accent ?? "text-gray-900")}>
          {value}
        </p>
        {hint ? (
          <p className="mt-1 text-[10px] text-gray-400 leading-snug hidden sm:block">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-gray-100 bg-white p-3 min-w-0", className)}>
      <div className="mb-2">
        <h3 className="text-xs font-semibold text-gray-800">{title}</h3>
        {subtitle ? <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

function ChartFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0" style={{ height: CHART_HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function RankingList({
  title,
  rows,
  currency,
  emptyLabel,
}: {
  title: string;
  rows: OrdersRankingRow[];
  currency: string;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3 min-w-0">
      <h3 className="text-xs font-semibold text-gray-800 mb-2">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-[11px] text-gray-400">{emptyLabel}</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((row, index) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 rounded-md bg-gray-50/70 px-2 py-1.5"
            >
              <div className="min-w-0 flex items-center gap-2">
                <span className="text-[10px] font-medium text-gray-400 tabular-nums w-3 shrink-0">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-gray-800 truncate">{row.label}</p>
                  <p className="text-[10px] text-gray-400 tabular-nums">
                    {row.count} ped.
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-medium text-gray-700 tabular-nums shrink-0">
                {formatAnalyticsMoney(row.revenue, currency)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function OrdersAnalyticsWorkspace({ orders, className }: OrdersAnalyticsWorkspaceProps) {
  const snapshot = useMemo(() => computeOrdersAnalyticsSnapshot(orders), [orders]);
  const { kpis } = snapshot;

  return (
    <section className={cn("w-full min-w-0 space-y-3", className)}>
      <div>
        <h2 className="text-sm font-semibold text-gray-800">Analítica operativa</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">Resumen de pedidos · últimos 7 días</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
        <KpiCard
          label="Ingresos totales"
          value={formatAnalyticsMoney(kpis.totalRevenue, kpis.currency)}
          hint="Pedidos pagos"
          accent="text-emerald-700"
        />
        <KpiCard label="Pedidos pagos" value={String(kpis.paidOrders)} hint="Confirmados" />
        <KpiCard
          label="Ticket promedio"
          value={formatAnalyticsMoney(kpis.averageTicket, kpis.currency)}
          hint="Por pedido pago"
        />
        <KpiCard
          label="Descargas"
          value={String(kpis.downloadsCompleted)}
          hint="Clientes que bajaron"
          accent="text-sky-700"
        />
        <KpiCard
          label="% digitales"
          value={formatAnalyticsPct(kpis.digitalPct)}
          hint="Mix aprox."
          accent="text-sky-700"
        />
        <KpiCard
          label="% impresión"
          value={formatAnalyticsPct(kpis.printPct)}
          hint="Mix aprox."
          accent="text-orange-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <ChartCard title="Ventas · 7 días" subtitle="Ingresos por día">
          <ChartFrame>
            <BarChart data={snapshot.dailySales} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={44} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value, name) => [
                  name === "revenue"
                    ? formatAnalyticsMoney(Number(value), kpis.currency)
                    : value,
                  name === "revenue" ? "Ingresos" : "Pedidos",
                ]}
              />
              <Bar dataKey="revenue" fill="#c27b3d" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ChartFrame>
        </ChartCard>

        <ChartCard title="Por tipo" subtitle="Pedidos pagos">
          <div style={{ height: CHART_HEIGHT }}>
            {snapshot.ordersByType.length === 0 ? (
              <EmptyChart message="Sin pedidos pagos." />
            ) : (
              <ChartFrame>
                <BarChart
                  data={snapshot.ordersByType}
                  layout="vertical"
                  margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="type"
                    width={64}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={14}>
                    {snapshot.ordersByType.map((entry) => (
                      <Cell key={entry.type} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartFrame>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Descargas" subtitle="Hechas vs pendientes">
          <div style={{ height: CHART_HEIGHT }}>
            {snapshot.downloadsChart.length === 0 ? (
              <EmptyChart message="Sin descargas disponibles." />
            ) : (
              <ChartFrame>
                <PieChart>
                  <Pie
                    data={snapshot.downloadsChart}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={68}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {snapshot.downloadsChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                </PieChart>
              </ChartFrame>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Digital vs impresión" subtitle="Mix de ventas">
          <div style={{ height: CHART_HEIGHT }}>
            {snapshot.fulfillmentMix.length === 0 ? (
              <EmptyChart message="Sin mix de formatos." />
            ) : (
              <ChartFrame>
                <PieChart>
                  <Pie
                    data={snapshot.fulfillmentMix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={68}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {snapshot.fulfillmentMix.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                </PieChart>
              </ChartFrame>
            )}
          </div>
        </ChartCard>
      </div>

      {snapshot.activityChart.length > 0 ? (
        <ChartCard title="Impresión y videos" subtitle="Pedidos pagos">
          <ChartFrame>
            <BarChart data={snapshot.activityChart} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {snapshot.activityChart.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartFrame>
        </ChartCard>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <div className="rounded-lg border border-gray-100 bg-white p-3">
          <h3 className="text-xs font-semibold text-gray-800 mb-2">Insights</h3>
          <ul className="space-y-1.5">
            {snapshot.insights.map((insight) => (
              <li
                key={insight.id}
                className="flex items-start gap-2 rounded-md bg-gray-50/70 px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-gray-800">{insight.title}</p>
                  <p className="mt-0.5 text-[10px] text-gray-500 leading-relaxed">{insight.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-2">
          <RankingList
            title="Top eventos"
            rows={snapshot.topEvents}
            currency={kpis.currency}
            emptyLabel="Sin ventas por evento."
          />
          <RankingList
            title="Top álbumes"
            rows={snapshot.topAlbums}
            currency={kpis.currency}
            emptyLabel="Sin ventas de álbum."
          />
          <RankingList
            title="Top tipos"
            rows={snapshot.topSaleTypes}
            currency={kpis.currency}
            emptyLabel="Sin tipos de venta."
          />
        </div>
      </div>
    </section>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-3 text-center text-[11px] text-gray-400">
      {message}
    </div>
  );
}
