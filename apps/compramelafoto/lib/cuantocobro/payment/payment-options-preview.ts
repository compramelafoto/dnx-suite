import type { CuantoCobroPaymentOptionsSnapshot } from "../payment/payment-options-types";
import { formatCuantoCobroCurrency } from "../calculate-cuanto-cobro";
import { hasPaymentOptionsPresentation } from "../payment/payment-options-calc";

export function formatPaymentOptionCashLine(
  snapshot: CuantoCobroPaymentOptionsSnapshot,
  fmt: (amount: number) => string,
): string {
  if (!snapshot.cash?.enabled) return "";
  if (snapshot.cash.discountPercent > 0) {
    return `1 pago: ${fmt(snapshot.cash.cashPrice)} (${snapshot.cash.discountPercent}% de descuento)`;
  }
  return `1 pago: ${fmt(snapshot.cash.cashPrice)}`;
}

export function formatPaymentOptionInstallmentLine(
  plan: CuantoCobroPaymentOptionsSnapshot["installmentPlans"][number],
  fmt: (amount: number) => string,
): string {
  const count = plan.numberOfInstallments;
  const label = count === 1 ? "1 cuota" : `${count} cuotas`;
  if (plan.interestPercent > 0) {
    return `${label} de ${fmt(plan.installmentAmount)} (${plan.interestPercent}% interés)`;
  }
  return `${label} de ${fmt(plan.installmentAmount)}`;
}

export function buildPaymentOptionsPreviewLines(
  snapshot: CuantoCobroPaymentOptionsSnapshot | null | undefined,
): string[] {
  if (!snapshot || !hasPaymentOptionsPresentation(snapshot)) return [];

  const fmt = (amount: number) => formatCuantoCobroCurrency(amount, snapshot.currency);
  const lines: string[] = [];

  const cashLine = formatPaymentOptionCashLine(snapshot, fmt);
  if (cashLine) lines.push(cashLine);

  for (const plan of snapshot.installmentPlans) {
    lines.push(formatPaymentOptionInstallmentLine(plan, fmt));
  }

  return lines;
}
