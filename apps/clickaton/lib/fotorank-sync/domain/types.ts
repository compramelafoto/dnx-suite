export type FotoRankValidationStatus =
  | "NOT_CONFIGURED"
  | "PENDING_VALIDATION"
  | "VALID"
  | "INVALID"
  | "DISABLED";

export type FotoRankSyncStatus =
  | "PENDING"
  | "PROCESSING"
  | "SYNCED"
  | "RETRY_PENDING"
  | "FAILED"
  | "MANUAL_REVIEW"
  | "DISABLED";

export type FotoRankSyncMode = "POST_PAID" | "DISABLED";

export type RegistrationPaidEvent = {
  eventType: "CLICKATON_REGISTRATION_PAID";
  eventVersion: 1;
  registrationId: string;
  editionId: string;
  userId: number;
  paymentOrderId: string | null;
  paidAt: string;
  idempotencyKey: string;
};

export type FotoRankContestView = {
  id: string;
  title: string;
  slug: string;
  status: string;
  visibility: string;
  experienceType: string;
  distributionChannel: string | null;
  registrationEnabled: boolean;
};

export type SyncErrorClass = "RETRYABLE" | "NON_RETRYABLE";

export class FotoRankSyncError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly errorClass: SyncErrorClass = "NON_RETRYABLE",
  ) {
    super(message);
    this.name = "FotoRankSyncError";
  }
}

export type SyncRecordView = {
  id: string;
  editionId: string;
  registrationId: string;
  userId: number;
  fotoRankContestId: string;
  fotoRankParticipantId: string | null;
  status: FotoRankSyncStatus;
  attemptCount: number;
  lastAttemptAt: Date | null;
  nextRetryAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  idempotencyKey: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
