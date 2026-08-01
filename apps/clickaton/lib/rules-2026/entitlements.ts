/**
 * Entitlements: returning participant early price + annual pass.
 * Annual pass consume: first CONTEST_PROMPTS_ACCESSED (idempotent).
 */

export type ReturningEligibility =
  | { eligible: true; reason: "WITHIN_WINDOW" }
  | { eligible: false; reason: "EXPIRED" | "NOT_STARTED" | "ALREADY_USED" | "WRONG_USER" | "WRONG_TARGET" };

export function evaluateReturningParticipantEarlyPrice(input: {
  userId: number;
  entitlementUserId: number;
  targetEditionId: string;
  entitlementTargetEditionId: string;
  startsAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  now: Date;
}): ReturningEligibility {
  if (input.userId !== input.entitlementUserId) {
    return { eligible: false, reason: "WRONG_USER" };
  }
  if (input.targetEditionId !== input.entitlementTargetEditionId) {
    return { eligible: false, reason: "WRONG_TARGET" };
  }
  if (input.usedAt) return { eligible: false, reason: "ALREADY_USED" };
  if (input.now.getTime() < input.startsAt.getTime()) {
    return { eligible: false, reason: "NOT_STARTED" };
  }
  if (input.now.getTime() > input.expiresAt.getTime()) {
    return { eligible: false, reason: "EXPIRED" };
  }
  return { eligible: true, reason: "WITHIN_WINDOW" };
}

/** Ventana [endsAt, endsAt + N days] inclusive day 1..N, exclusive after N. */
export function returningWindow(input: {
  sourceEditionEndedAt: Date;
  days: number;
}): { startsAt: Date; expiresAt: Date } {
  const startsAt = new Date(input.sourceEditionEndedAt.getTime());
  const expiresAt = new Date(
    input.sourceEditionEndedAt.getTime() + input.days * 24 * 60 * 60 * 1000,
  );
  return { startsAt, expiresAt };
}

export function annualPassPriceMinor(currentEditionPriceMinor: number): number {
  if (!Number.isInteger(currentEditionPriceMinor) || currentEditionPriceMinor < 0) {
    throw new Error("invalid_edition_price");
  }
  return currentEditionPriceMinor * 4;
}

export type PromptAccessConsumeResult =
  | { consumed: true; consumedCredits: number }
  | { consumed: false; reason: "ALREADY_CONSUMED_THIS_EDITION" | "NO_CREDITS" | "INACTIVE" };

/**
 * Idempotent: same (entitlementId, editionId, CONTEST_PROMPTS_ACCESSED) → no double consume.
 */
export function consumeAnnualPassOnPromptsAccess(input: {
  status: "ACTIVE" | "EXHAUSTED" | "CANCELLED";
  totalCredits: number;
  consumedCredits: number;
  alreadyConsumedForEdition: boolean;
}): PromptAccessConsumeResult {
  if (input.status !== "ACTIVE") {
    return { consumed: false, reason: "INACTIVE" };
  }
  if (input.alreadyConsumedForEdition) {
    return { consumed: false, reason: "ALREADY_CONSUMED_THIS_EDITION" };
  }
  if (input.consumedCredits >= input.totalCredits) {
    return { consumed: false, reason: "NO_CREDITS" };
  }
  return {
    consumed: true,
    consumedCredits: input.consumedCredits + 1,
  };
}

export type RegistrationTransferResult =
  | { ok: true; status: "TRANSFERRED_TO_NEXT_EDITION" }
  | { ok: false; reason: "ALREADY_TRANSFERRED" | "EXPIRED" | "NOT_UNUSED" };

export function transferUnusedIndividualRegistration(input: {
  transferCount: number;
  maxTransfers: number;
  participated: boolean;
}): RegistrationTransferResult {
  if (input.participated) return { ok: false, reason: "NOT_UNUSED" };
  if (input.transferCount >= input.maxTransfers) {
    return { ok: false, reason: "ALREADY_TRANSFERRED" };
  }
  return { ok: true, status: "TRANSFERRED_TO_NEXT_EDITION" };
}

export function expireAfterSecondMiss(input: {
  transferCount: number;
  maxTransfers: number;
  participatedSecondChance: boolean;
}): "EXPIRED" | "ACTIVE" {
  if (input.transferCount >= input.maxTransfers && !input.participatedSecondChance) {
    return "EXPIRED";
  }
  return "ACTIVE";
}
