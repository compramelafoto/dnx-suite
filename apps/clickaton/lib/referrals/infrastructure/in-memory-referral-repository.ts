import type {
  ReferralAttemptInput,
  ReferralAttributionRecord,
  ReferralCodeRecord,
  ReferralRepository,
} from "../domain/repository";

export type InMemorySeed = {
  codes?: ReferralCodeRecord[];
  attributions?: ReferralAttributionRecord[];
  /** userId → email */
  emails?: Record<number, string>;
  /** userIds con inscripción CONFIRMED */
  confirmados?: number[];
};

export function createInMemoryReferralRepository(seed: InMemorySeed = {}) {
  const codes = [...(seed.codes ?? [])];
  const attributions = [...(seed.attributions ?? [])];
  const emails = { ...(seed.emails ?? {}) };
  const confirmados = new Set(seed.confirmados ?? []);
  const attempts: ReferralAttemptInput[] = [];
  let sequence = 0;

  const repo: ReferralRepository = {
    async findCodeByCode(code) {
      return codes.find((c) => c.code === code) ?? null;
    },
    async findCodeByUserId(userId) {
      return codes.find((c) => c.userId === userId) ?? null;
    },
    async createCode({ userId, code }) {
      sequence += 1;
      const record: ReferralCodeRecord = {
        id: `code-${sequence}`,
        userId,
        code,
        isActive: true,
      };
      codes.push(record);
      return record;
    },
    async findUserEmail(userId) {
      return emails[userId] ?? null;
    },
    async tieneInscripcionConfirmada(userId) {
      return confirmados.has(userId);
    },
    async findAttributionByReferredUserId(referredUserId) {
      return (
        attributions.find(
          (a) => a.referredUserId === referredUserId && a.status !== "REVOKED",
        ) ?? null
      );
    },
    async findAttributionByRegistrationId(registrationId) {
      return attributions.find((a) => a.registrationId === registrationId) ?? null;
    },
    async createAttribution(input) {
      sequence += 1;
      const record: ReferralAttributionRecord = {
        id: `attr-${sequence}`,
        ...input,
        status: "EARNED",
        earnedAt: new Date("2026-09-23T12:00:00Z"),
        revokedAt: null,
        revokedReason: null,
        consumedAt: null,
        consumedRegistrationId: null,
      };
      attributions.push(record);
      return record;
    },
    async revokeAttribution({ registrationId, reason }) {
      const found = attributions.find(
        (a) => a.registrationId === registrationId && a.status === "EARNED",
      );
      if (!found) return null;
      found.status = "REVOKED";
      found.revokedAt = new Date("2026-09-23T12:00:00Z");
      found.revokedReason = reason;
      return found;
    },
    async contarColegasTraidos(referrerUserId) {
      return attributions.filter(
        (a) => a.referrerUserId === referrerUserId && a.status === "EARNED",
      ).length;
    },
    async recordAttempt(input) {
      attempts.push(input);
    },
  };

  return {
    repo,
    /** Para aserciones en los tests. */
    inspect: () => ({ codes, attributions, attempts }),
  };
}
