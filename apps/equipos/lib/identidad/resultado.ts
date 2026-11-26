import type { IdentityVerificationStatus } from "@repo/db";
import { hashDni, normalizeDni } from "./dni";

export type ProviderResult = {
  providerRef: string;
  outcome: "approved" | "rejected" | "review";
  documentNumber?: string;
  legalName?: string;
  reason?: string;
};

export type VerificationDecision = {
  status: IdentityVerificationStatus;
  documentHash: string | null;
  documentLast3: string | null;
  legalName: string | null;
  rejectionReason: string | null;
};

const EMPTY = {
  documentHash: null,
  documentLast3: null,
  legalName: null,
  rejectionReason: null,
} as const;

export function decideVerification(
  result: ProviderResult,
  ctx: { userId: number; hashOwnerUserId: number | null; pepper: string },
): VerificationDecision {
  if (result.outcome === "rejected") {
    return { ...EMPTY, status: "REJECTED", rejectionReason: result.reason ?? null };
  }
  if (result.outcome === "review") {
    return { ...EMPTY, status: "IN_REVIEW" };
  }

  const dni = result.documentNumber ? normalizeDni(result.documentNumber) : null;
  const legalName = result.legalName?.trim() || null;
  if (!dni || !legalName) {
    return { ...EMPTY, status: "IN_REVIEW" };
  }

  const documentHash = hashDni(dni, ctx.pepper);
  if (ctx.hashOwnerUserId !== null && ctx.hashOwnerUserId !== ctx.userId) {
    return { ...EMPTY, status: "REJECTED", rejectionReason: "DNI_YA_USADO" };
  }
  return {
    status: "APPROVED",
    documentHash,
    documentLast3: dni.slice(-3),
    legalName,
    rejectionReason: null,
  };
}
