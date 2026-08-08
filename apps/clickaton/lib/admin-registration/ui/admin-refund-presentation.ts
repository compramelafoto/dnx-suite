import type { ClickatonPaymentStatus, ClickatonRegistrationStatus } from "@/lib/registration/domain/types";
import { displayRegistrationAmount } from "@/lib/admin-registration/ui/status-labels";

export type AdminRefundBadge =
  | { kind: "none" }
  | {
      kind: "total" | "partial";
      label: "REEMBOLSADA" | "REEMBOLSO PARCIAL";
      tone: "danger" | "warning";
    };

export function presentAdminRefundBadge(input: {
  registrationStatus: ClickatonRegistrationStatus | string;
  paymentStatus: ClickatonPaymentStatus | string;
}): AdminRefundBadge {
  if (
    input.registrationStatus === "REFUNDED" ||
    input.paymentStatus === "REFUNDED"
  ) {
    return { kind: "total", label: "REEMBOLSADA", tone: "danger" };
  }
  if (input.paymentStatus === "PARTIALLY_REFUNDED") {
    return { kind: "partial", label: "REEMBOLSO PARCIAL", tone: "warning" };
  }
  return { kind: "none" };
}

export function presentAdminRefundAmounts(input: {
  totalAmount: number;
  refundedAmountMinor: number | null | undefined;
  currency?: string;
}): {
  paidLabel: string;
  refundedLabel: string;
  netLabel: string;
  refundType: "none" | "partial" | "total";
} {
  const currency = input.currency ?? "ARS";
  const refunded = Math.max(0, input.refundedAmountMinor ?? 0);
  const net = Math.max(0, input.totalAmount - refunded);
  const refundType =
    refunded <= 0
      ? "none"
      : refunded >= input.totalAmount
        ? "total"
        : "partial";
  return {
    paidLabel: displayRegistrationAmount(input.totalAmount, currency),
    refundedLabel: displayRegistrationAmount(refunded, currency),
    netLabel: displayRegistrationAmount(net, currency),
    refundType,
  };
}

/** Métricas pagadas: excluye reembolsos totales. */
export function countsAsPaidRegistration(input: {
  registrationStatus: string;
  paymentStatus: string;
}): boolean {
  if (input.registrationStatus === "REFUNDED") return false;
  if (input.paymentStatus === "REFUNDED") return false;
  return (
    input.registrationStatus === "CONFIRMED" &&
    (input.paymentStatus === "APPROVED" || input.paymentStatus === "PARTIALLY_REFUNDED")
  );
}
