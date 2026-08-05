/**
 * ETAPA 08 — tipos de publicación controlada (genéricos, sin modelos SantaFe*).
 * Persistidos en FotorankResultBatch.metadata / RuleSet.configJson.
 *
 * BORRADOR — LEGAL REVIEW REQUIRED — NO PUBLICAR
 */

export type PublicationReadinessStatus = "READY" | "BLOCKED";

export type PublicationReasonCode =
  | "JURY_SESSION_NOT_CLOSED"
  | "RESULT_BATCH_MISSING"
  | "RESULT_BATCH_STALE"
  | "RESULT_BATCH_NOT_FINALIZED"
  | "RUBRIC_NOT_CONFIRMED"
  | "AWARDS_NOT_CONFIRMED"
  | "INCOMPLETE_COVERAGE"
  | "UNRESOLVED_TIE"
  | "INSTITUTIONAL_APPROVAL_MISSING"
  | "LEGAL_APPROVAL_MISSING"
  | "PUBLICATION_DATE_MISSING"
  | "CATEGORY_RESULT_INCOMPLETE"
  | "PRIVACY_CHECK_FAILED"
  | "CONTEST_NOT_READY"
  | "PUBLICATION_ALREADY_LIVE"
  | "RESULT_REVOKED"
  | "FINALISTS_NOT_CONFIGURED"
  | "WINNERS_NOT_CONFIGURED"
  | "PUBLICATION_HASH_MISMATCH"
  | "CONFIRMATION_REQUIRED"
  | "SOURCE_NOT_CANONICAL";

export type ApprovalStatus =
  | "NOT_REQUESTED"
  | "PENDING"
  | "IN_REVIEW"
  | "APPROVED"
  | "CHANGES_REQUIRED"
  | "REJECTED"
  | "REVOKED";

export type FinalistSelectionStatus =
  | "NOT_SELECTED"
  | "AUTO_SELECTED"
  | "MANUALLY_SELECTED"
  | "REMOVED_WITH_REASON"
  | "APPROVED"
  | "REVOKED";

export type ConfigDecisionStatus =
  | "PENDING_ORGANIZER_DECISION"
  | "STAGING_TEST_CONFIGURATION"
  | "CONFIRMED";

export type ResultPublicationMeta = {
  schemaVersion: 1;
  rubricConfirmation?: {
    status: ConfigDecisionStatus;
    confirmedAt?: string;
    confirmedByUserId?: number;
    note?: string;
  };
  awardsConfig?: {
    status: ConfigDecisionStatus;
    placeholders?: string[];
    updatedAt?: string;
    updatedByUserId?: number;
  };
  finalistsConfig?: {
    status: ConfigDecisionStatus;
    mode: "AUTO_TOP_N" | "MANUAL" | "MIXED";
    topNByCategorySlug?: Record<string, number>;
    defaultTopN?: number;
  };
  finalistSelections?: Array<{
    juryEntrySnapshotId: string;
    categoryId: string;
    anonymousCode: string;
    status: FinalistSelectionStatus;
    reason?: string;
    actorUserId?: number;
    at?: string;
  }>;
  winnerSelections?: Array<{
    juryEntrySnapshotId: string;
    categoryId: string;
    anonymousCode: string;
    awardType: "FIRST_PLACE" | "SECOND_PLACE" | "THIRD_PLACE" | "MENTION" | "SPECIAL";
    source: "RANKING" | "MANUAL_OVERRIDE" | "COMMITTEE";
    reason?: string;
    actorUserId?: number;
    at?: string;
  }>;
  committeeDecisions?: Array<{
    id: string;
    tieGroup: string;
    orderedSnapshotIds: string[];
    members: string[];
    reason: string;
    decidedByUserId: number;
    at: string;
  }>;
  institutionalReview?: {
    status: ApprovalStatus;
    actorUserId?: number;
    at?: string;
    notes?: string;
  };
  legalReview?: {
    status: ApprovalStatus;
    actorUserId?: number;
    at?: string;
    notes?: string;
    basesVersionRef?: string;
    privacyVersionRef?: string;
  };
  publication?: {
    status: "PRIVATE" | "SCHEDULED" | "LIVE" | "REVOKED" | "SUPERSEDED";
    hash?: string;
    scheduledAt?: string | null;
    timezone?: string;
    publishedAt?: string;
    publishedByUserId?: number;
    revokedAt?: string;
    revokedByUserId?: number;
    revokeReason?: string;
    stagingTest?: boolean;
    publicScoresMode?: "HIDDEN" | "TOTAL_ONLY" | "FULL";
  };
  publicCreditsPolicy?: {
    showAuthorName: boolean;
    showPseudonym: boolean;
    showInstagram: boolean;
    showLocality: boolean;
  };
};

export type PublicationReadiness = {
  status: PublicationReadinessStatus;
  reasonCodes: PublicationReasonCode[];
  warnings: string[];
  missingApprovals: string[];
  publishableCategorySlugs: string[];
  nonPublishableCategorySlugs: string[];
  batchId: string | null;
  sessionId: string | null;
  publicationHash: string | null;
  meta: ResultPublicationMeta | null;
};

export const SANTA_FE_PUBLICATION_TZ = "America/Argentina/Cordoba";
export const SANTA_FE_PUBLISH_CONFIRM_PHRASE = "PUBLICAR RESULTADOS DE SANTA FE EN FOCO";
export const STAGING_TEST_PUBLICATION_PHRASE = "STAGING_TEST_PUBLICATION";

export function emptyPublicationMeta(): ResultPublicationMeta {
  return {
    schemaVersion: 1,
    rubricConfirmation: { status: "PENDING_ORGANIZER_DECISION" },
    awardsConfig: {
      status: "PENDING_ORGANIZER_DECISION",
      placeholders: [
        "PENDING_ORGANIZER_DECISION",
        "PENDING_LEGAL_REVIEW",
        "PENDING_SPONSOR_CONFIRMATION",
      ],
    },
    finalistsConfig: {
      status: "PENDING_ORGANIZER_DECISION",
      mode: "AUTO_TOP_N",
      defaultTopN: 3,
    },
    institutionalReview: { status: "PENDING" },
    legalReview: { status: "NOT_REQUESTED" },
    publication: {
      status: "PRIVATE",
      publicScoresMode: "HIDDEN",
      timezone: SANTA_FE_PUBLICATION_TZ,
    },
    publicCreditsPolicy: {
      showAuthorName: true,
      showPseudonym: true,
      showInstagram: false,
      showLocality: true,
    },
  };
}

export function parsePublicationMeta(raw: unknown): ResultPublicationMeta {
  const base = emptyPublicationMeta();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const m = raw as Partial<ResultPublicationMeta>;
  return {
    ...base,
    ...m,
    schemaVersion: 1,
    rubricConfirmation: { ...base.rubricConfirmation!, ...m.rubricConfirmation },
    awardsConfig: { ...base.awardsConfig!, ...m.awardsConfig },
    finalistsConfig: { ...base.finalistsConfig!, ...m.finalistsConfig },
    institutionalReview: { ...base.institutionalReview!, ...m.institutionalReview },
    legalReview: { ...base.legalReview!, ...m.legalReview },
    publication: { ...base.publication!, ...m.publication },
    publicCreditsPolicy: { ...base.publicCreditsPolicy!, ...m.publicCreditsPolicy },
    finalistSelections: m.finalistSelections ?? base.finalistSelections,
    winnerSelections: m.winnerSelections ?? base.winnerSelections,
    committeeDecisions: m.committeeDecisions ?? base.committeeDecisions,
  };
}
