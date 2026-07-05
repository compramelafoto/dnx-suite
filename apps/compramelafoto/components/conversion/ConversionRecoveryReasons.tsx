"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "@/components/ui/Card";
import type { RecoveryReasonBreakdown } from "@/lib/conversion-analytics/types";
import { RECOVERY_REASON_LABELS } from "@/lib/conversion-analytics";

const BAR_COLORS = ["#c27b3d", "#0ea5e9", "#8b5cf6", "#94a3b8"];

type Props = {
  reasons: RecoveryReasonBreakdown;
  className?: string;
};

export default function ConversionRecoveryReasons({ reasons, className = "" }: Props) {
  const total =
    reasons.same_cart +
    reasons.fewer_photos +
    reasons.product_change +
    reasons.complete_change;

  const chartData = (Object.keys(RECOVERY_REASON_LABELS) as Array<keyof RecoveryReasonBreakdown>).map(
    (key, index) => ({
      key,
      label: RECOVERY_REASON_LABELS[key],
      count: reasons[key],
      pct: total > 0 ? Math.round((reasons[key] / total) * 1000) / 10 : 0,
      fill: BAR_COLORS[index % BAR_COLORS.length],
    })
  );

  return (
    <Card className={`p-4 sm:p-6 w-full min-w-0 ${className}`}>
      <div className="mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-[#111827]">Motivos de recuperación</h3>
        <p className="text-sm text-[#6b7280] mt-1 leading-relaxed">
          Un par por cada abandono (PENDING) vinculado al primer pago exitoso del mismo comprador. Puede haber
          varios pares por comprador si reintentó varias veces.
        </p>
      </div>

      {total === 0 ? (
        <p className="text-sm text-[#6b7280]">Todavía no hay recuperaciones en este período.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
            {chartData.map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-3 py-3 min-w-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#374151] truncate">{row.label}</p>
                  <p className="text-xs text-[#6b7280]">{row.pct}% del total</p>
                </div>
                <p className="text-lg font-semibold tabular-nums text-[#111827] shrink-0">{row.count}</p>
              </div>
            ))}
          </div>
          <div className="w-full min-w-0 h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={56} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                <Tooltip
                  formatter={(value) => [Number(value), "Recuperaciones"]}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.key} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
}
