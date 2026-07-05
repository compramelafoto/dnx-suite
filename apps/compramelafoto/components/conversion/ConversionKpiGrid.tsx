"use client";

import Card from "@/components/ui/Card";
import type { ConversionSummary, RecoveredRevenue } from "@/lib/conversion-analytics/types";
import { formatConversionArs, formatConversionPct } from "@/lib/conversion-analytics";

type Props = {
  summary: ConversionSummary;
  recoveredRevenue: RecoveredRevenue;
  className?: string;
};

function KpiCard({
  label,
  value,
  hint,
  accentClass,
}: {
  label: string;
  value: string;
  hint?: string;
  accentClass?: string;
}) {
  return (
    <Card className="p-4 sm:p-5 min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">{label}</p>
      <p className={`mt-2 text-2xl sm:text-3xl font-semibold tabular-nums ${accentClass ?? "text-[#111827]"}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[#6b7280] leading-relaxed">{hint}</p> : null}
    </Card>
  );
}

export default function ConversionKpiGrid({ summary, recoveredRevenue, className = "" }: Props) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 w-full min-w-0 ${className}`}>
      <KpiCard label="Intentos de compra" value={summary.purchaseAttempts.toLocaleString("es-AR")} hint="Pedidos creados en Mercado Pago" />
      <KpiCard
        label="Compras realizadas"
        value={summary.completedPurchases.toLocaleString("es-AR")}
        accentClass="text-emerald-700"
        hint="Pagos confirmados (PAID)"
      />
      <KpiCard
        label="Conversión"
        value={formatConversionPct(summary.conversionRatePct)}
        accentClass="text-[#9a5f2e]"
        hint="Compras / intentos"
      />
      <KpiCard
        label="Abandonos recuperados"
        value={summary.recoveredAbandonments.toLocaleString("es-AR")}
        hint={`${formatConversionPct(summary.recoveryRatePct)} de abandonadores · compradores únicos`}
      />
      <KpiCard
        label="Abandonos reales"
        value={summary.realAbandonments.toLocaleString("es-AR")}
        hint="Compradores que nunca pagaron en el álbum"
      />
      <KpiCard
        label="Ingresos recuperados"
        value={formatConversionArs(recoveredRevenue.totalArs)}
        accentClass="text-emerald-700"
        hint={`Ticket prom. ${formatConversionArs(recoveredRevenue.averageTicketArs)} · ${recoveredRevenue.recoveryPairs} pagos recuperados únicos`}
      />
    </div>
  );
}
