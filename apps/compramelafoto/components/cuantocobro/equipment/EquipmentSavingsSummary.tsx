"use client";

import { formatCuantoCobroCurrency } from "@/lib/cuantocobro/calculate-cuanto-cobro";
import type { EquipmentSavingsBreakdown } from "@/lib/cuantocobro/equipment/types";

type Props = {
  savings: EquipmentSavingsBreakdown;
  currency: string;
};

export default function EquipmentSavingsSummary({ savings, currency }: Props) {
  const fmt = (amount: number) => formatCuantoCobroCurrency(amount, currency || "ARS");

  if (savings.totalMonthly <= 0 && !savings.usesLegacyRenewalFallback) {
    return null;
  }

  return (
    <div className="cc-equipment-totals" role="status" aria-label="Resumen de ahorro por equipamiento">
      {savings.renewalMonthly > 0 ? (
        <div className="cc-equipment-totals__row">
          <span className="cc-equipment-totals__label">Renovación</span>
          <span className="cc-equipment-totals__value">{fmt(savings.renewalMonthly)}/mes</span>
        </div>
      ) : savings.usesLegacyRenewalFallback ? (
        <div className="cc-equipment-totals__row cc-equipment-totals__row--legacy">
          <span className="cc-equipment-totals__label">Renovación (dato anterior)</span>
          <span className="cc-equipment-totals__value">{fmt(savings.renewalMonthly)}/mes</span>
        </div>
      ) : null}
      {savings.expansionMonthly > 0 ? (
        <div className="cc-equipment-totals__row">
          <span className="cc-equipment-totals__label">Ampliación</span>
          <span className="cc-equipment-totals__value">{fmt(savings.expansionMonthly)}/mes</span>
        </div>
      ) : null}
      {savings.totalMonthly > 0 ? (
        <div className="cc-equipment-totals__row cc-equipment-totals__row--total">
          <span className="cc-equipment-totals__label">Total en tu necesidad mensual</span>
          <span className="cc-equipment-totals__value">{fmt(savings.totalMonthly)}/mes</span>
        </div>
      ) : null}
    </div>
  );
}
