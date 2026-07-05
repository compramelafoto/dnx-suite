"use client";

import Card from "@/components/ui/Card";
import type { OrganizerCommissionFinancialDashboard } from "@/lib/admin/organizer-commission-financial-dashboard";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatMoney(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
}

function MetricCard({
  title,
  value,
  subtitle,
  accent = "default",
}: {
  title: string;
  value: string;
  subtitle?: string;
  accent?: "default" | "amber" | "emerald" | "blue" | "violet" | "red";
}) {
  const accentClass = {
    default: "border-gray-200",
    amber: "border-amber-200 bg-amber-50/40",
    emerald: "border-emerald-200 bg-emerald-50/40",
    blue: "border-blue-200 bg-blue-50/40",
    violet: "border-violet-200 bg-violet-50/30",
    red: "border-red-200 bg-red-50/40",
  }[accent];

  return (
    <Card className={`p-4 sm:p-5 border shadow-sm ds-card min-w-0 ${accentClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 m-0 mb-1">{title}</p>
      <p className="text-xl sm:text-2xl font-bold text-gray-900 m-0 tabular-nums leading-tight">{value}</p>
      {subtitle ? (
        <p className="ds-readable-text ds-readable-text--fluid text-xs text-gray-600 m-0 mt-2">{subtitle}</p>
      ) : null}
    </Card>
  );
}

export default function OrganizerCommissionFinancialCommandCenter({
  data,
  loading,
}: {
  data: OrganizerCommissionFinancialDashboard | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="ds-stack-section min-w-0">
        <p className="text-sm text-gray-600 m-0" role="status">
          Cargando métricas financieras…
        </p>
      </div>
    );
  }

  if (!data) return null;

  const { commissions: c, withdrawals: w } = data;

  return (
    <div className="ds-stack-section min-w-0 space-y-6">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-gray-900 m-0">Command center financiero</h2>
        <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-600 m-0 mt-1">
          Vista global de comisiones de organizadores por eventos. Los montos reflejan deuda hacia organizadores,
          no ingresos de la plataforma.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Comisiones generadas"
          value={formatMoney(c.totalGenerated)}
          subtitle="Histórico acumulado (no canceladas)"
          accent="violet"
        />
        <MetricCard
          title="Pendiente de pago"
          value={formatMoney(c.pendingOwed)}
          subtitle="Pertenece al organizador y aún no fue transferido"
          accent="amber"
        />
        <MetricCard
          title="Pagado a organizadores"
          value={formatMoney(c.totalPaid)}
          subtitle={`${c.percentPaid}% del total generado`}
          accent="emerald"
        />
        <MetricCard
          title="Últimos 30 días"
          value={formatMoney(c.last30DaysGenerated)}
          subtitle="Comisiones generadas recientemente"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Retenido (período de espera)"
          value={formatMoney(c.heldRetained)}
          subtitle="Aún no disponible para retiro (15 días)"
          accent="blue"
        />
        <MetricCard
          title="Disponible sin retirar"
          value={formatMoney(c.availableBalance)}
          subtitle="Listo para solicitud de retiro"
        />
        <MetricCard
          title="En pipeline de retiro"
          value={formatMoney(c.inWithdrawalPipeline)}
          subtitle="Incluido en solicitudes abiertas"
          accent="amber"
        />
        <MetricCard
          title="Promedio por retiro pagado"
          value={formatMoney(w.averagePaidWithdrawal)}
          subtitle={`${w.paidCount} retiros liquidados`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <MetricCard
          title="Solicitudes pendientes"
          value={`${w.pendingCount}`}
          subtitle={formatMoney(w.pendingAmount)}
          accent="amber"
        />
        <MetricCard
          title="Solicitudes aprobadas"
          value={`${w.approvedCount}`}
          subtitle={formatMoney(w.approvedAmount)}
          accent="blue"
        />
        <MetricCard
          title="Solicitudes rechazadas"
          value={`${w.rejectedCount}`}
          subtitle={formatMoney(w.rejectedAmount)}
          accent="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4 sm:p-5 border border-gray-200 shadow-sm ds-card min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 m-0 mb-4">Comisiones generadas por mes</h3>
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.commissionsByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip
                  formatter={(value) => [formatMoney(Number(value ?? 0)), "Generado"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }}
                />
                <Legend />
                <Bar dataKey="amount" name="Comisiones" fill="#c27b3d" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 border border-gray-200 shadow-sm ds-card min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 m-0 mb-4">Retiros pagados por mes</h3>
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.withdrawalsByMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                <Tooltip
                  formatter={(value) => [formatMoney(Number(value ?? 0)), "Pagado"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }}
                />
                <Legend />
                <Bar dataKey="amount" name="Retiros" fill="#1f2937" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {data.topOrganizersByPending.length > 0 ? (
        <Card className="p-4 sm:p-5 border border-gray-200 shadow-sm ds-card min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 m-0 mb-3">Organizadores con mayor deuda pendiente</h3>
          <div className="ds-table-scroll">
            <table className="w-full text-sm border-collapse min-w-[520px]">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600">
                  <th className="py-2 pr-3 font-semibold">Organizador</th>
                  <th className="py-2 pr-3 font-semibold text-right">Pendiente</th>
                  <th className="py-2 pr-3 font-semibold text-right">Generado</th>
                  <th className="py-2 font-semibold text-right">Ventas</th>
                </tr>
              </thead>
              <tbody>
                {data.topOrganizersByPending.map((o) => (
                  <tr key={o.organizerUserId} className="border-b border-gray-100">
                    <td className="py-2 pr-3 min-w-0">
                      <div className="font-medium text-gray-900">{o.organizerName}</div>
                      <div className="text-xs text-gray-500 truncate">{o.organizerEmail}</div>
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold text-amber-900 tabular-nums">
                      {formatMoney(o.pendingAmount)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(o.totalGenerated)}</td>
                    <td className="py-2 text-right tabular-nums">{o.salesCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
