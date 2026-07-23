/**
 * Dual-control architecture for productive DistributionVersion publish (MVP prep).
 * I1 does NOT publish. Future: second human approver.
 */

import { createHash, randomBytes } from "node:crypto";

export type DistributionPublishChallengeStatus =
  | "PENDING_PREVIEW"
  | "CHALLENGE_ISSUED"
  | "CONFIRMED"
  | "EXPIRED"
  | "CONSUMED"
  | "CANCELLED";

export type DistributionPublishChallenge = {
  id: string;
  agreementId: string;
  draftVersionId: string;
  initiatedByUserId: number;
  /** SHA-256 of single-use challenge code — never store plaintext. */
  challengeHash: string;
  /** Exact confirmation text required (e.g. PUBLISH CLICKATON DISTRIBUTION). */
  requiredConfirmationText: string;
  status: DistributionPublishChallengeStatus;
  previewAt: Date;
  challengeIssuedAt: Date | null;
  expiresAt: Date | null;
  confirmedAt: Date | null;
  consumedAt: Date | null;
  /** Reserved for future second-approver userId. */
  secondApproverUserId: number | null;
};

export const DEFAULT_DISTRIBUTION_PUBLISH_CONFIRMATION =
  "PUBLICO VERSION DE DISTRIBUCION PRODUCTIVA CLICKATON" as const;

export function hashPublishChallengeCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function createDistributionPublishChallenge(input: {
  agreementId: string;
  draftVersionId: string;
  initiatedByUserId: number;
  ttlMs?: number;
  now?: Date;
}): { challenge: DistributionPublishChallenge; plaintextCode: string } {
  const now = input.now ?? new Date();
  const plaintextCode = randomBytes(16).toString("base64url");
  const ttl = input.ttlMs ?? 15 * 60 * 1000;
  const challenge: DistributionPublishChallenge = {
    id: `dpc_${randomBytes(8).toString("hex")}`,
    agreementId: input.agreementId,
    draftVersionId: input.draftVersionId,
    initiatedByUserId: input.initiatedByUserId,
    challengeHash: hashPublishChallengeCode(plaintextCode),
    requiredConfirmationText: DEFAULT_DISTRIBUTION_PUBLISH_CONFIRMATION,
    status: "CHALLENGE_ISSUED",
    previewAt: now,
    challengeIssuedAt: now,
    expiresAt: new Date(now.getTime() + ttl),
    confirmedAt: null,
    consumedAt: null,
    secondApproverUserId: null,
  };
  return { challenge, plaintextCode };
}

export function verifyDistributionPublishChallenge(input: {
  challenge: DistributionPublishChallenge;
  code: string;
  confirmationText: string;
  actorUserId: number;
  now?: Date;
}): { ok: true } | { ok: false; reason: string } {
  const now = input.now ?? new Date();
  if (input.challenge.status !== "CHALLENGE_ISSUED") {
    return { ok: false, reason: "invalid_status" };
  }
  if (input.challenge.initiatedByUserId !== input.actorUserId) {
    return { ok: false, reason: "initiator_mismatch" };
  }
  if (input.challenge.expiresAt && input.challenge.expiresAt.getTime() < now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  if (hashPublishChallengeCode(input.code) !== input.challenge.challengeHash) {
    return { ok: false, reason: "bad_code" };
  }
  if (input.confirmationText.trim() !== input.challenge.requiredConfirmationText) {
    return { ok: false, reason: "bad_confirmation_text" };
  }
  return { ok: true };
}
