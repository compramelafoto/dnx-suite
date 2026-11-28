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

/** Lo que la fila ya tenía guardado de una verificación anterior aprobada. */
export type PreviousIdentity = {
  documentHash: string | null;
  documentLast3: string | null;
  legalName: string | null;
};

export function decideVerification(
  result: ProviderResult,
  ctx: {
    userId: number;
    /** Otro usuario que ya tiene este hash (en cualquier estado), o null. */
    hashOwnerUserId: number | null;
    pepper: string;
    previous?: PreviousIdentity | null;
  },
): VerificationDecision {
  // Un DNI ya verificado nunca se libera: si la fila tenía hash, se conserva siempre.
  const kept: Omit<VerificationDecision, "status" | "rejectionReason"> = ctx.previous?.documentHash
    ? {
        documentHash: ctx.previous.documentHash,
        documentLast3: ctx.previous.documentLast3,
        legalName: ctx.previous.legalName,
      }
    : { documentHash: null, documentLast3: null, legalName: null };

  if (result.outcome === "rejected") {
    return { ...kept, status: "REJECTED", rejectionReason: result.reason ?? null };
  }
  if (result.outcome === "review") {
    return { ...kept, status: "IN_REVIEW", rejectionReason: null };
  }

  const dni = result.documentNumber ? normalizeDni(result.documentNumber) : null;
  const legalName = result.legalName?.trim() || null;
  if (!dni || !legalName) {
    return { ...kept, status: "IN_REVIEW", rejectionReason: null };
  }

  const documentHash = hashDni(dni, ctx.pepper);
  if (ctx.hashOwnerUserId !== null && ctx.hashOwnerUserId !== ctx.userId) {
    return { ...kept, status: "REJECTED", rejectionReason: "DNI_YA_USADO" };
  }
  if (ctx.previous?.documentHash && ctx.previous.documentHash !== documentHash) {
    // Cambio de identidad: lo decide una persona.
    return { ...kept, status: "IN_REVIEW", rejectionReason: "DNI_DISTINTO" };
  }
  return {
    status: "APPROVED",
    documentHash,
    documentLast3: dni.slice(-3),
    legalName,
    rejectionReason: null,
  };
}
