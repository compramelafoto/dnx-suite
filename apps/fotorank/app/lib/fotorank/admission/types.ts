/**
 * Tipos de admisión técnica nativa FotoRank (genérico multi-concurso).
 * Estados lógicos se mapean a enums Prisma existentes — sin enums duplicados.
 */

import type { AdmissionReasonCode } from "./reason-codes";

/** Flujo lógico de producto (documentación / UI). */
export type LogicalAdmissionState =
  | "UPLOADED"
  | "AUTO_CHECK_PENDING"
  | "AUTO_CHECK_PASSED"
  | "AUTO_CHECK_FAILED"
  | "MANUAL_REVIEW_REQUIRED"
  | "EVIDENCE_REQUESTED"
  | "REPLACEMENT_ALLOWED"
  | "ADMITTED"
  | "REJECTED"
  | "WITHDRAWN"
  | "FROZEN";

export type AdmissionQueueFilter =
  | "all"
  | "requires_review"
  | "date_observed"
  | "territory_observed"
  | "device_observed"
  | "argra_pending"
  | "drone_unidentified"
  | "possible_duplicate"
  | "evidence_requested"
  | "replacement_pending"
  | "ready_to_admit"
  | "rejected"
  | "admitted"
  | "frozen";

export type EvidenceType =
  | "ORIGINAL"
  | "RAW"
  | "SOFTWARE_SCREENSHOT"
  | "LOCATION_EVIDENCE"
  | "DATE_CLARIFICATION"
  | "DEVICE_CLARIFICATION"
  | "ARGRA_CORRECTION";

export type EvidenceRequestStatus = "OPEN" | "RESPONDED" | "RESOLVED" | "EXPIRED";

export type EvidenceRequestRecord = {
  id: string;
  types: EvidenceType[];
  reasonCode: AdmissionReasonCode;
  publicMessage: string;
  internalNote?: string | null;
  requestedAt: string;
  deadlineAt?: string | null;
  status: EvidenceRequestStatus;
  requestedByUserId: number;
  participantResponse?: string | null;
  respondedAt?: string | null;
  resolvedAt?: string | null;
  resolvedByUserId?: number | null;
};

export type AdmissionOpsMetadata = {
  evidenceRequest?: EvidenceRequestRecord | null;
  lastReasonCodes?: string[];
  rulesVersion?: string | null;
  contestRulesVersion?: string | null;
  notificationIntents?: Array<{
    type: "EVIDENCE_REQUESTED" | "REPLACEMENT_ALLOWED" | "ADMITTED" | "REJECTED" | "FROZEN";
    at: string;
    entryId: string;
  }>;
  territoryResolution?: {
    resolvedAt: string;
    resolvedByUserId: number;
    outcome: "ACCEPTED" | "REJECTED" | "EVIDENCE";
    note?: string | null;
  };
  captureWindowResolution?: {
    resolvedAt: string;
    resolvedByUserId: number;
    outcome: "ACCEPTED_WITH_EVIDENCE" | "REJECTED" | "REPLACEMENT" | "RAW_REQUESTED";
    note?: string | null;
  };
  argraAdminNote?: string | null;
};

export type AdmissionEngineDecision = {
  logicalState: LogicalAdmissionState;
  admissionStatus:
    | "PENDING_AUTOMATIC_REVIEW"
    | "PENDING_MANUAL_REVIEW"
    | "ELIGIBLE"
    | "ADMITTED"
    | "REJECTED"
    | "FROZEN_FOR_JURY"
    | "WITHDRAWN"
    | "REPLACED";
  entryStatusHint?: "REQUIRES_REVIEW" | "READY_TO_CONFIRM" | "REJECTED" | "CONFIRMED";
  technicalSummaryHint?:
    | "APPROVED"
    | "APPROVED_WITH_WARNINGS"
    | "REQUIRES_REVIEW"
    | "TECHNICALLY_REJECTED";
  manualReviewHint?: "NONE" | "PENDING" | "REPLACEMENT_REQUESTED";
  reasonCodes: AdmissionReasonCode[];
  autoReject: boolean;
  requiresManualReview: boolean;
  blocksJury: boolean;
};

export const ADMISSION_ENGINE_VERSION = "fotorank-admission-v1";
export const ADMISSION_RULES_VERSION = "santa-fe-admission-draft-v1";

export type ArgraAdminStatus =
  | "NOT_REQUIRED"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED"
  | "EVIDENCE_REQUESTED";
