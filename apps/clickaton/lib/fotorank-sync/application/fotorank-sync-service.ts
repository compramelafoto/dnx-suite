/**
 * Servicio de sync Clickatón → FotoRank (in-memory para tests + contrato Prisma).
 * Nunca revierte PAID. Idempotente por registrationId + contestId.
 */
import {
  classifySyncErrorCode,
  nextRetryAt,
  shouldMoveToManualReview,
} from "../domain/retry";
import {
  FotoRankSyncError,
  type FotoRankContestView,
  type FotoRankValidationStatus,
  type RegistrationPaidEvent,
  type SyncRecordView,
} from "../domain/types";

export type SyncEditionConfig = {
  id: string;
  fotorankContestId: string | null;
  fotoRankSyncEnabled: boolean;
  fotoRankSyncMode: "POST_PAID" | "DISABLED";
  fotoRankValidationStatus: FotoRankValidationStatus;
};

export type SyncRegistration = {
  id: string;
  editionId: string;
  userId: number;
  status: string;
  paymentStatus: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  visibleCode: string | null;
  sequenceNumber: number | null;
  confirmedAt: Date | null;
  paymentOrderId: string | null;
  instagramHandle: string | null;
  profilePhotoAssetId: string | null;
};

export type SyncParticipant = {
  id: string;
  contestId: string;
  userId: number;
  externalRegistrationId: string | null;
  clickatonParticipantNumber: string | null;
  enabled: boolean;
};

export type InMemoryFotoRankSyncStore = {
  editions: Map<string, SyncEditionConfig>;
  registrations: Map<string, SyncRegistration>;
  contests: Map<string, FotoRankContestView>;
  usersById: Map<number, { id: number; email: string }>;
  usersByEmail: Map<string, { id: number; email: string }>;
  participants: Map<string, SyncParticipant>;
  /** contestId:externalRegistrationId → participantId */
  byExternalReg: Map<string, string>;
  /** contestId:userId → participantId */
  byContestUser: Map<string, string>;
  syncs: Map<string, SyncRecordView>;
  outbox: Map<string, { id: string; idempotencyKey: string; status: string; payload: RegistrationPaidEvent }>;
  audits: Array<{ action: string; meta: Record<string, unknown>; at: Date }>;
  /** Fuerza fallo en próximo process (tests). */
  nextProcessError?: { code: string; message: string } | null;
  /** Simula timeout después de crear participante. */
  failAfterCreate?: boolean;
};

export function createInMemoryFotoRankSyncStore(): InMemoryFotoRankSyncStore {
  return {
    editions: new Map(),
    registrations: new Map(),
    contests: new Map(),
    usersById: new Map(),
    usersByEmail: new Map(),
    participants: new Map(),
    byExternalReg: new Map(),
    byContestUser: new Map(),
    syncs: new Map(),
    outbox: new Map(),
    audits: [],
    nextProcessError: null,
    failAfterCreate: false,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function syncKey(registrationId: string, contestId: string): string {
  return `${registrationId}:${contestId}`;
}

function idempotencyKeyFor(registrationId: string, contestId: string): string {
  return `fr_sync:${registrationId}:${contestId}`;
}

export function createFotoRankSyncService(store: InMemoryFotoRankSyncStore) {
  function failSync(
    sync: SyncRecordView,
    code: string,
    message: string,
    errorClass: "RETRYABLE" | "NON_RETRYABLE",
  ): SyncRecordView {
    sync.lastErrorCode = code;
    sync.lastErrorMessage = message.slice(0, 200);
    sync.updatedAt = new Date();
    if (shouldMoveToManualReview(sync.attemptCount, errorClass)) {
      sync.status = "MANUAL_REVIEW";
      sync.nextRetryAt = null;
    } else {
      sync.status = "RETRY_PENDING";
      sync.nextRetryAt = nextRetryAt(sync.attemptCount);
    }
    store.audits.push({
      action: "FR_SYNC_FAILED",
      meta: { syncId: sync.id, code, status: sync.status },
      at: new Date(),
    });
    return sync;
  }

  function validateContest(contestId: string): FotoRankContestView {
    const contest = store.contests.get(contestId);
    if (!contest) {
      throw new FotoRankSyncError("CONTEST_NOT_FOUND", "Concurso FotoRank inexistente.");
    }
    if (contest.status === "CANCELLED" || contest.status === "ARCHIVED") {
      throw new FotoRankSyncError("CONTEST_INACTIVE", `Concurso status=${contest.status}.`);
    }
    return contest;
  }

  function resolveUser(reg: SyncRegistration): { id: number; email: string } {
    const byId = store.usersById.get(reg.userId);
    if (byId) return byId;
    const byEmail = store.usersByEmail.get(normalizeEmail(reg.email));
    if (byEmail) return byEmail;
    // Usuario DNX ya existe en registration.userId en prod; en memoria lo aceptamos.
    const created = { id: reg.userId, email: normalizeEmail(reg.email) };
    store.usersById.set(created.id, created);
    store.usersByEmail.set(created.email, created);
    return created;
  }

  function upsertParticipant(input: {
    contestId: string;
    userId: number;
    registrationId: string;
    editionId: string;
    reg: SyncRegistration;
  }): SyncParticipant {
    const extKey = `${input.contestId}:${input.registrationId}`;
    const existingExt = store.byExternalReg.get(extKey);
    if (existingExt) {
      return store.participants.get(existingExt)!;
    }
    const userKey = `${input.contestId}:${input.userId}`;
    const existingUser = store.byContestUser.get(userKey);
    if (existingUser) {
      const p = store.participants.get(existingUser)!;
      p.externalRegistrationId = input.registrationId;
      p.clickatonParticipantNumber = input.reg.visibleCode;
      store.byExternalReg.set(extKey, p.id);
      return p;
    }
    const id = `frp_${store.participants.size + 1}`;
    const participant: SyncParticipant = {
      id,
      contestId: input.contestId,
      userId: input.userId,
      externalRegistrationId: input.registrationId,
      clickatonParticipantNumber: input.reg.visibleCode,
      enabled: true,
    };
    store.participants.set(id, participant);
    store.byExternalReg.set(extKey, id);
    store.byContestUser.set(userKey, id);
    if (store.failAfterCreate) {
      throw new FotoRankSyncError("TIMEOUT", "Timeout after create", "RETRYABLE");
    }
    return participant;
  }

  return {
    validateEditionContestLink(editionId: string): {
      status: FotoRankValidationStatus;
      contest: FotoRankContestView | null;
      error: string | null;
    } {
      const edition = store.editions.get(editionId);
      if (!edition?.fotorankContestId) {
        return { status: "NOT_CONFIGURED", contest: null, error: null };
      }
      try {
        const contest = validateContest(edition.fotorankContestId);
        return { status: "VALID", contest, error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "invalid";
        return { status: "INVALID", contest: null, error: msg };
      }
    },

    enqueueFromPaidEvent(event: RegistrationPaidEvent): {
      enqueued: boolean;
      syncId: string | null;
      reason?: string;
    } {
      const reg = store.registrations.get(event.registrationId);
      if (!reg) return { enqueued: false, syncId: null, reason: "REGISTRATION_NOT_FOUND" };
      if (reg.paymentStatus !== "APPROVED" && reg.status !== "CONFIRMED") {
        return { enqueued: false, syncId: null, reason: "NOT_PAID" };
      }
      const edition = store.editions.get(event.editionId);
      if (!edition) return { enqueued: false, syncId: null, reason: "EDITION_NOT_FOUND" };
      if (!edition.fotoRankSyncEnabled || edition.fotoRankSyncMode !== "POST_PAID") {
        return { enqueued: false, syncId: null, reason: "SYNC_DISABLED" };
      }
      if (!edition.fotorankContestId) {
        return { enqueued: false, syncId: null, reason: "NO_CONTEST" };
      }

      const key = syncKey(reg.id, edition.fotorankContestId);
      const existing = [...store.syncs.values()].find(
        (s) => s.registrationId === reg.id && s.fotoRankContestId === edition.fotorankContestId,
      );
      if (existing) {
        store.outbox.set(event.idempotencyKey, {
          id: `ob_${event.idempotencyKey}`,
          idempotencyKey: event.idempotencyKey,
          status: "PROCESSED",
          payload: event,
        });
        return { enqueued: false, syncId: existing.id, reason: "ALREADY_EXISTS" };
      }

      const now = new Date();
      const sync: SyncRecordView = {
        id: `sync_${key}`,
        editionId: edition.id,
        registrationId: reg.id,
        userId: reg.userId,
        fotoRankContestId: edition.fotorankContestId,
        fotoRankParticipantId: null,
        status: "PENDING",
        attemptCount: 0,
        lastAttemptAt: null,
        nextRetryAt: now,
        lastErrorCode: null,
        lastErrorMessage: null,
        idempotencyKey: idempotencyKeyFor(reg.id, edition.fotorankContestId),
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      store.syncs.set(sync.id, sync);
      store.outbox.set(event.idempotencyKey, {
        id: `ob_${event.idempotencyKey}`,
        idempotencyKey: event.idempotencyKey,
        status: "PENDING",
        payload: event,
      });
      store.audits.push({
        action: "FR_SYNC_ENQUEUED",
        meta: { registrationId: reg.id, contestId: edition.fotorankContestId },
        at: now,
      });
      return { enqueued: true, syncId: sync.id };
    },

    processSync(syncId: string): SyncRecordView {
      const sync = store.syncs.get(syncId);
      if (!sync) throw new FotoRankSyncError("SYNC_NOT_FOUND", "Sync inexistente.");
      if (sync.status === "SYNCED") return sync;

      const reg = store.registrations.get(sync.registrationId);
      if (!reg) {
        return failSync(sync, "REGISTRATION_MISSING", "Inscripción no encontrada", "NON_RETRYABLE");
      }
      if (reg.paymentStatus !== "APPROVED") {
        return failSync(sync, "NOT_PAID", "Inscripción no PAID", "NON_RETRYABLE");
      }

      sync.status = "PROCESSING";
      sync.attemptCount += 1;
      sync.lastAttemptAt = new Date();
      sync.updatedAt = new Date();

      if (store.nextProcessError) {
        const err = store.nextProcessError;
        store.nextProcessError = null;
        const cls = classifySyncErrorCode(err.code);
        return failSync(sync, err.code, err.message, cls);
      }

      try {
        validateContest(sync.fotoRankContestId);
        const user = resolveUser(reg);
        const participant = upsertParticipant({
          contestId: sync.fotoRankContestId,
          userId: user.id,
          registrationId: reg.id,
          editionId: reg.editionId,
          reg,
        });
        sync.fotoRankParticipantId = participant.id;
        sync.status = "SYNCED";
        sync.completedAt = new Date();
        sync.lastErrorCode = null;
        sync.lastErrorMessage = null;
        sync.nextRetryAt = null;
        sync.updatedAt = new Date();
        store.audits.push({
          action: "FR_SYNC_SYNCED",
          meta: {
            syncId: sync.id,
            participantId: participant.id,
            number: participant.clickatonParticipantNumber,
          },
          at: new Date(),
        });
        return sync;
      } catch (err) {
        if (err instanceof FotoRankSyncError) {
          return failSync(sync, err.code, err.message, err.errorClass);
        }
        return failSync(
          sync,
          "TEMPORARY",
          err instanceof Error ? err.message : "unknown",
          "RETRYABLE",
        );
      }
    },

    failSync,

    processDue(now = new Date()): number {
      let n = 0;
      for (const sync of store.syncs.values()) {
        if (
          (sync.status === "PENDING" || sync.status === "RETRY_PENDING") &&
          sync.nextRetryAt &&
          sync.nextRetryAt <= now
        ) {
          this.processSync(sync.id);
          n += 1;
        }
      }
      return n;
    },

    listByEdition(editionId: string): SyncRecordView[] {
      return [...store.syncs.values()].filter((s) => s.editionId === editionId);
    },

    getByRegistration(registrationId: string): SyncRecordView | null {
      return [...store.syncs.values()].find((s) => s.registrationId === registrationId) ?? null;
    },

    markManualReview(syncId: string): SyncRecordView {
      const sync = store.syncs.get(syncId);
      if (!sync) throw new FotoRankSyncError("SYNC_NOT_FOUND", "Sync inexistente.");
      sync.status = "MANUAL_REVIEW";
      sync.nextRetryAt = null;
      sync.updatedAt = new Date();
      return sync;
    },

    retry(syncId: string): SyncRecordView {
      const sync = store.syncs.get(syncId);
      if (!sync) throw new FotoRankSyncError("SYNC_NOT_FOUND", "Sync inexistente.");
      if (sync.status === "SYNCED") return sync;
      sync.status = "PENDING";
      sync.nextRetryAt = new Date();
      return this.processSync(syncId);
    },
  };
}

export type FotoRankSyncService = ReturnType<typeof createFotoRankSyncService>;

export function buildRegistrationPaidEvent(input: {
  registrationId: string;
  editionId: string;
  userId: number;
  paymentOrderId: string | null;
  paidAt?: Date;
}): RegistrationPaidEvent {
  const paidAt = (input.paidAt ?? new Date()).toISOString();
  return {
    eventType: "CLICKATON_REGISTRATION_PAID",
    eventVersion: 1,
    registrationId: input.registrationId,
    editionId: input.editionId,
    userId: input.userId,
    paymentOrderId: input.paymentOrderId,
    paidAt,
    idempotencyKey: `clickaton:registration_paid:${input.registrationId}`,
  };
}

export function assertNoFinancialLeak(payload: unknown): void {
  const json = JSON.stringify(payload);
  const forbidden = [
    "accessToken",
    "refreshToken",
    "providerFee",
    "allocationAmount",
    "financialDistribution",
    "credentialReference",
  ];
  for (const key of forbidden) {
    if (json.includes(key)) {
      throw new FotoRankSyncError("FINANCIAL_LEAK", `Payload contains forbidden key ${key}`);
    }
  }
}
