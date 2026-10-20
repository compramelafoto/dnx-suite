/**
 * Resumen del precio de un trabajo armado con varios renglones (FOTOFFICE corre el motor una vez por
 * concepto). PURO. Suma los renglones y calcula a nivel trabajo lo que no se reparte: la seña, el
 * saldo y el aviso de precio mínimo.
 */
import { parsePercent } from "./price-build-up";
import { parseCuantoCobroAmount } from "../amount-format";
import type { CuantoCobroPriceBuildUp, CuantoCobroPricingExtras } from "./types";

export type CuantoCobroJobPricingSummary = {
  priceWithoutVat: number;
  iva: number;
  total: number;
  grossIncomeTax: number;
  commission: number;
  takeHome: number;
  surchargeAmount: number;
  travelCost: number;
  eventInsurance: number;
  retouchPrice: number;
  inflationAmount: number;
  deposit: { percent: number; amount: number } | null;
  balance: number;
  overtimeHourPrice: number | null;
  suggestedTransferDiscountPercent: number | null;
  minimumJobPrice: number | null;
  belowMinimum: boolean;
  cancellationPolicy: string | null;
  warnings: string[];
};

const MINIMO = "Este precio queda por debajo de tu precio mínimo por trabajo.";

export function summarizeJobPricing(
  lines: readonly CuantoCobroPriceBuildUp[],
  extras: CuantoCobroPricingExtras | null | undefined,
): CuantoCobroJobPricingSummary | null {
  if (lines.length === 0) return null;
  const sum = (f: (l: CuantoCobroPriceBuildUp) => number) => lines.reduce((s, l) => s + f(l), 0);
  const total = sum((l) => l.total);
  const priceWithoutVat = sum((l) => l.priceWithoutVat);
  const depositPercent = parsePercent(extras?.depositPercent) ?? 0;
  const deposit = depositPercent > 0 ? { percent: depositPercent, amount: Math.round((total * depositPercent) / 100) } : null;
  const minimum = extras ? (parseCuantoCobroAmount(extras.minimumJobPrice ?? "") ?? 0) : 0;
  const belowMinimum = minimum > 0 && priceWithoutVat < minimum;
  const warnings = [...new Set(lines.flatMap((l) => l.warnings).filter((w) => w !== MINIMO))];
  if (belowMinimum) warnings.push(MINIMO);
  return {
    priceWithoutVat,
    iva: sum((l) => l.iva),
    total,
    grossIncomeTax: sum((l) => l.grossIncomeTax),
    commission: sum((l) => l.commission),
    takeHome: sum((l) => l.takeHome),
    surchargeAmount: sum((l) => l.surchargeAmount),
    travelCost: sum((l) => l.travel?.cost ?? 0),
    eventInsurance: sum((l) => l.eventInsurance),
    retouchPrice: sum((l) => l.retouch?.price ?? 0),
    inflationAmount: sum((l) => l.inflation?.amount ?? 0),
    deposit,
    balance: total - (deposit?.amount ?? 0),
    overtimeHourPrice: lines[0]!.overtimeHourPrice,
    suggestedTransferDiscountPercent: lines[0]!.suggestedTransferDiscountPercent,
    minimumJobPrice: minimum > 0 ? minimum : null,
    belowMinimum,
    cancellationPolicy: lines[0]!.cancellationPolicy,
    warnings,
  };
}
