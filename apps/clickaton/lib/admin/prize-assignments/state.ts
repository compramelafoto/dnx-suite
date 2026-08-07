import type { PrizeBundleStatus } from "@/lib/rules-2026/prize-bundles";

/** Decisión canónica de ganador (vive en auditJson; el bundle tiene el status físico). */
export type PrizeAssignmentDecision =
  | "NONE"
  | "PROPOSED"
  | "CONFIRMED"
  | "REVOKED"
  | "CANCELLED"
  | "DELIVERED";

export type PrizeAssignmentStateView = {
  bundleStatus: PrizeBundleStatus;
  decision: PrizeAssignmentDecision;
  winnerRegistrationId: string | null;
  deliveredAt: Date | null;
  replacedAt: Date | null;
};

export function canMarkAvailable(input: {
  bundleStatus: PrizeBundleStatus;
}): boolean {
  return input.bundleStatus === "DRAFT" || input.bundleStatus === "REPLACED";
}

/** Confirmar ganador: bundle disponible (o reemplazado) y sin entrega vigente. */
export function canConfirm(input: PrizeAssignmentStateView): boolean {
  if (input.deliveredAt) return false;
  if (input.bundleStatus !== "AVAILABLE" && input.bundleStatus !== "REPLACED") {
    return false;
  }
  return (
    input.decision === "NONE" ||
    input.decision === "PROPOSED" ||
    input.decision === "REVOKED" ||
    input.decision === "CANCELLED"
  );
}

/** Revocar: hay ganador confirmado o entregado. */
export function canRevoke(input: PrizeAssignmentStateView): boolean {
  if (!input.winnerRegistrationId) return false;
  if (input.decision !== "CONFIRMED" && input.decision !== "DELIVERED") {
    return false;
  }
  return input.bundleStatus === "ASSIGNED" || input.bundleStatus === "DELIVERED";
}

/** Reemplazar: mismo criterio que revocar sobre asignación activa. */
export function canReplace(input: PrizeAssignmentStateView): boolean {
  return canRevoke(input);
}

/** Cancelar: propuesto o confirmado (no entregado). */
export function canCancel(input: PrizeAssignmentStateView): boolean {
  if (input.bundleStatus === "DELIVERED" || input.deliveredAt) return false;
  if (input.decision === "PROPOSED") return true;
  if (input.decision === "CONFIRMED" && input.bundleStatus === "ASSIGNED") {
    return true;
  }
  return false;
}

/** Entregar: confirmado y bundle ASSIGNED. */
export function canDeliver(input: PrizeAssignmentStateView): boolean {
  if (input.deliveredAt) return false;
  if (!input.winnerRegistrationId) return false;
  return input.decision === "CONFIRMED" && input.bundleStatus === "ASSIGNED";
}

export function isConfirmedWinnerForEligibility(input: {
  bundleStatus: PrizeBundleStatus;
  decision: PrizeAssignmentDecision;
  winnerRegistrationId: string | null;
}): boolean {
  if (!input.winnerRegistrationId) return false;
  if (input.decision !== "CONFIRMED" && input.decision !== "DELIVERED") {
    return false;
  }
  return input.bundleStatus === "ASSIGNED" || input.bundleStatus === "DELIVERED";
}
