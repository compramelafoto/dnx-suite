import type {
  DnxPartnerAudienceType,
  DnxPartnerBenefitAccessSource,
  DnxPartnerBenefitAccessStatus,
  DnxPartnerBenefitStatus,
} from "./types";

export const ELIGIBILITY_REASON_CODES = [
  "EDITION_PARTICIPANT",
  "CONFIRMED_EDITION_PARTICIPANT",
  "EDITION_PURCHASER",
  "CATEGORY_PARTICIPANT",
  "WINNER",
  "FINALIST",
  "MANUAL_USER",
  "MANUAL_GRANT",
  "MISSING_CANONICAL_USER",
  "AUDIENCE_NOT_EVALUABLE",
  "BENEFIT_NOT_ACTIVE",
  "BENEFIT_OUT_OF_WINDOW",
  "REGISTRATION_CANCELLED",
  "IDENTITY_AMBIGUOUS",
  "SKIPPED_NO_SOURCE",
] as const;
export type EligibilityReasonCode = (typeof ELIGIBILITY_REASON_CODES)[number];

export const ELIGIBILITY_SOURCE_TYPES = [
  "CLICKATON_REGISTRATION",
  "CLICKATON_PRIZE_ASSIGNMENT",
  "FOTORANK_RESULT_ENTRY",
  "ADMIN",
  "AUDIENCE_MANUAL_USER",
] as const;
export type EligibilitySourceType = (typeof ELIGIBILITY_SOURCE_TYPES)[number];

/** Snapshot de inscripción / sujeto Clickatón (sin PII sensible más allá de email para resolve). */
export type ClickatonRegistrationSubject = {
  registrationId: string;
  editionId: string;
  userId: number | null;
  email: string | null;
  status: string;
  paymentStatus: string;
  /** IDs de categoría competitiva conocidos (prompt/result), no ticketType. */
  categoryIds: string[];
  cancelled: boolean;
};

export type ClickatonWinnerSubject = {
  registrationId: string;
  assignmentId: string;
  prizeBundleId: string;
  categoryId: string | null;
  winnerVersion: number;
  userId: number | null;
  email: string | null;
};

export type ClickatonFinalistSubject = {
  registrationId: string;
  resultEntryId: string;
  userId: number | null;
  email: string | null;
};

export type ClickatonEligibilitySnapshot = {
  editionId: string;
  registrations: ClickatonRegistrationSubject[];
  winners: ClickatonWinnerSubject[];
  finalists: ClickatonFinalistSubject[];
  /** userId → true si existe en User */
  knownUserIds: ReadonlySet<number>;
  /** email normalizado → userId (solo matches exactos ya resueltos por el adapter) */
  emailToUserId: ReadonlyMap<string, number>;
};

export type BenefitAudienceInput = {
  id: string;
  audienceType: DnxPartnerAudienceType;
  contextType: string | null;
  contextId: string | null;
  organizationId: string | null;
  manualUserId: number | null;
  label: string | null;
  metadata: Record<string, unknown> | null;
};

export type BenefitForEligibility = {
  id: string;
  partnerId: string;
  participationId: string | null;
  status: DnxPartnerBenefitStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  archivedAt: Date | null;
  audiences: BenefitAudienceInput[];
};

export type EligibilitySubjectResult = {
  eligible: boolean;
  materializable: boolean;
  subjectType: "USER" | "PENDING_IDENTITY" | "NONE";
  userId: number | null;
  reasonCode: EligibilityReasonCode;
  sourceType: EligibilitySourceType;
  sourceId: string;
  audienceKey: string;
  /** Solo ids — sin PII completa */
  registrationId?: string;
};

export type AudienceEvaluationResult = {
  audienceId: string;
  audienceKey: string;
  evaluable: boolean;
  deferredReason?: EligibilityReasonCode;
  subjects: EligibilitySubjectResult[];
};

export type BenefitEligibilityEvaluation = {
  benefitId: string;
  editionId: string;
  benefitActive: boolean;
  withinWindow: boolean;
  audiences: AudienceEvaluationResult[];
  eligibleSubjects: EligibilitySubjectResult[];
  materializableSubjects: EligibilitySubjectResult[];
  pendingIdentity: EligibilitySubjectResult[];
  notEvaluableAudiences: AudienceEvaluationResult[];
};

export type SyncAccessPlanItem = {
  action: "GRANT" | "KEEP" | "REVOKE" | "SKIP_PENDING" | "SKIP";
  accessKey: string;
  userId: number | null;
  source: DnxPartnerBenefitAccessSource;
  sourceType: string | null;
  sourceId: string | null;
  reasonCode: string | null;
  status: DnxPartnerBenefitAccessStatus;
  existingAccessId?: string;
};

export type BenefitAccessSyncPlan = {
  benefitId: string;
  editionId: string;
  mode: "PREVIEW" | "APPLY";
  evaluation: BenefitEligibilityEvaluation;
  toGrant: SyncAccessPlanItem[];
  toKeep: SyncAccessPlanItem[];
  toRevoke: SyncAccessPlanItem[];
  pendingIdentity: SyncAccessPlanItem[];
  errors: string[];
};

export type EffectiveBenefitAccess = {
  benefitId: string;
  userId: number;
  hasAccess: boolean;
  sources: Array<"MANUAL" | "AUTOMATIC">;
  explanation: string;
  reasonCodes: string[];
};
