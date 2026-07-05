"use client";

import {
  formatCollaborativeEventMoneyPesos,
  type EventOrganizerSaleBreakdown,
} from "@/lib/event-organizer-commission-display";

type Variant = "full" | "compact" | "inline";
type Audience = "photographer" | "organizer" | "admin";

type Props = {
  breakdown: EventOrganizerSaleBreakdown;
  variant?: Variant;
  audience?: Audience;
  className?: string;
};

function Money({ amount, emphasis }: { amount: number; emphasis?: "net" | "deduction" }) {
  const color =
    emphasis === "net"
      ? "text-emerald-800 font-semibold"
      : emphasis === "deduction"
        ? "text-amber-900"
        : "text-gray-900";
  return (
    <span className={`tabular-nums whitespace-nowrap ${color}`}>
      {formatCollaborativeEventMoneyPesos(amount)}
    </span>
  );
}

export function CollaborativeEventOrganizerBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-violet-50 text-violet-900 border-violet-200 whitespace-nowrap ${className}`}
    >
      Evento con comisión de organizador
    </span>
  );
}

export default function CollaborativeEventSaleBreakdown({
  breakdown,
  variant = "full",
  audience = "photographer",
  className = "",
}: Props) {
  const estimateNote = breakdown.isEstimate
    ? "Montos estimados; se confirman cuando el pago queda acreditado."
    : null;

  const organizerLabel =
    audience === "organizer" ? "Tu comisión" : "Comisión organizador";

  if (variant === "inline") {
    return (
      <div className={`text-xs text-gray-600 space-y-0.5 ${className}`}>
        <div className="flex flex-wrap items-center gap-2">
          <CollaborativeEventOrganizerBadge />
          {breakdown.eventTitle ? (
            <span className="text-gray-500 truncate max-w-[200px]" title={breakdown.eventTitle}>
              {breakdown.eventTitle}
            </span>
          ) : null}
        </div>
        {audience === "photographer" ? (
          <p className="m-0">
            Neto a recibir: <Money amount={breakdown.photographerNetAmount} emphasis="net" />
            <span className="text-gray-400 mx-1">·</span>
            Cliente pagó: <Money amount={breakdown.totalPaidAmount} />
          </p>
        ) : (
          <p className="m-0">
            {organizerLabel}: <Money amount={breakdown.organizerCommissionAmount} emphasis="net" />
            <span className="text-gray-400 mx-1">·</span>
            Cliente pagó: <Money amount={breakdown.totalPaidAmount} />
          </p>
        )}
        {estimateNote ? <p className="m-0 text-amber-800">{estimateNote}</p> : null}
      </div>
    );
  }

  const rows: Array<{
    label: string;
    amount: number;
    emphasis?: "net" | "deduction";
    prefix?: string;
  }> =
    audience === "organizer"
      ? [
          { label: "Cliente pagó", amount: breakdown.totalPaidAmount },
          { label: "Precio base fotógrafo", amount: breakdown.photographerBaseAmount },
          { label: organizerLabel, amount: breakdown.organizerCommissionAmount, emphasis: "net" },
          { label: "Neto fotógrafo", amount: breakdown.photographerNetAmount },
          { label: "Fee plataforma", amount: breakdown.platformFeeAmount },
        ]
      : audience === "admin"
        ? [
            { label: "Cliente pagó", amount: breakdown.totalPaidAmount },
            { label: "Precio base fotógrafo", amount: breakdown.photographerBaseAmount },
            { label: "Comisión organizador", amount: breakdown.organizerCommissionAmount, emphasis: "deduction" },
            { label: "Fee plataforma", amount: breakdown.platformFeeAmount },
            { label: "Neto fotógrafo (MP)", amount: breakdown.photographerNetAmount, emphasis: "net" },
            {
              label: "Retiene plataforma",
              amount: breakdown.platformFeeAmount + breakdown.organizerCommissionAmount,
              emphasis: "net",
            },
          ]
        : [
            { label: "Cliente pagó", amount: breakdown.totalPaidAmount },
            { label: "Precio de venta (tu base)", amount: breakdown.photographerBaseAmount },
            {
              label: `Comisión organizador (${breakdown.organizerCommissionPercentage}%)`,
              amount: breakdown.organizerCommissionAmount,
              emphasis: "deduction",
              prefix: "−",
            },
            { label: "Fee plataforma", amount: breakdown.platformFeeAmount },
            { label: "Monto neto a recibir", amount: breakdown.photographerNetAmount, emphasis: "net" },
          ];

  if (variant === "compact") {
    return (
      <div className={`rounded-lg border border-violet-100 bg-violet-50/40 p-3 space-y-2 min-w-0 ${className}`}>
        <CollaborativeEventOrganizerBadge />
        <dl className="m-0 grid grid-cols-1 gap-1 text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-3 ds-content-container">
              <dt className="text-gray-600 m-0 ds-readable-text">{r.label}</dt>
              <dd className="m-0 text-right shrink-0">
                {r.prefix}
                <Money amount={r.amount} emphasis={r.emphasis} />
              </dd>
            </div>
          ))}
        </dl>
        {estimateNote ? (
          <p className="text-xs text-amber-800 m-0 ds-readable-text">{estimateNote}</p>
        ) : audience === "photographer" ? (
          <p className="text-xs text-gray-600 m-0 ds-readable-text">
            El organizador del evento configuró una comisión sobre el precio base de tus fotos. Ese monto no se
            acredita en tu cuenta de Mercado Pago.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`ds-card rounded-xl border border-violet-100 bg-white shadow-sm p-4 space-y-3 min-w-0 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <CollaborativeEventOrganizerBadge />
        {breakdown.eventTitle ? (
          <span className="text-sm text-gray-600 ds-readable-text truncate max-w-full" title={breakdown.eventTitle}>
            {breakdown.eventTitle}
          </span>
        ) : null}
      </div>
      <dl className="m-0 space-y-2 text-sm">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex justify-between gap-4 items-baseline border-b border-gray-50 pb-2 last:border-0 last:pb-0"
          >
            <dt className="text-gray-600 m-0 ds-readable-text flex-1 min-w-0">{r.label}</dt>
            <dd className="m-0 text-right shrink-0">
              {r.prefix}
              <Money amount={r.amount} emphasis={r.emphasis} />
            </dd>
          </div>
        ))}
      </dl>
      {estimateNote ? (
        <p className="text-xs text-amber-800 m-0 ds-readable-text border-t border-amber-100 pt-2">{estimateNote}</p>
      ) : audience === "photographer" ? (
        <p className="text-xs text-gray-600 m-0 ds-readable-text ds-readable-text--fluid border-t border-gray-100 pt-2">
          El organizador del evento configuró una comisión sobre el precio base de tus fotos. Ese monto queda retenido
          por la plataforma para liquidárselo al organizador; no se transfiere a tu Mercado Pago.
        </p>
      ) : null}
    </div>
  );
}
