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
    async findUserIdByEmail(email) {
      const buscado = email.trim().toLowerCase();
      const found = Object.entries(emails).find(
        ([, mail]) => mail.trim().toLowerCase() === buscado,
      );
      return found ? Number(found[0]) : null;
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
    async reservarAtribuciones({ referrerUserId, cantidad, ref }) {
      // Las más viejas primero: se gastan en el orden en que se ganaron.
      const disponibles = attributions
        .filter((a) => a.referrerUserId === referrerUserId && a.status === "EARNED")
        .sort((a, b) => a.earnedAt.getTime() - b.earnedAt.getTime())
        .slice(0, cantidad);

      for (const attr of disponibles) {
        attr.status = "RESERVED";
        attr.consumedRegistrationId = ref;
      }
      return disponibles.length;
    },
    async adjuntarReserva({ ref, registrationId }) {
      const reservadas = attributions.filter(
        (a) => a.consumedRegistrationId === ref && a.status === "RESERVED",
      );
      for (const attr of reservadas) attr.consumedRegistrationId = registrationId;
      return reservadas.length;
    },
    async confirmarAtribucionesReservadas(registrationId) {
      const reservadas = attributions.filter(
        (a) => a.consumedRegistrationId === registrationId && a.status === "RESERVED",
      );
      for (const attr of reservadas) {
        attr.status = "CONSUMED";
        attr.consumedAt = new Date("2026-09-23T12:00:00Z");
      }
      return reservadas.length;
    },
    async liberarAtribucionesReservadas(registrationId) {
      const reservadas = attributions.filter(
        (a) => a.consumedRegistrationId === registrationId && a.status === "RESERVED",
      );
      for (const attr of reservadas) {
        attr.status = "EARNED";
        attr.consumedRegistrationId = null;
      }
      return reservadas.length;
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
