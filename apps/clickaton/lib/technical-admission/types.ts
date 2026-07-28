export const ADMISSION_ENGINE_VERSION = "clickaton-admission-v1";
export const ADMISSION_RULES_DRAFT_VERSION = "clickaton-admission-rules-draft-v1";

export type AdmissionStatus =
  | "NOT_EVALUATED"
  | "PENDING_AUTOMATIC_REVIEW"
  | "PENDING_MANUAL_REVIEW"
  | "ELIGIBLE"
  | "ADMITTED"
  | "REJECTED"
  | "EXCLUDED"
  | "WITHDRAWN"
  | "REPLACED"
  | "FROZEN_FOR_JURY";

export type AccreditationAdmissionPolicy =
  | "NOT_REQUIRED"
  | "REQUIRED"
  | "OPTIONAL_WITH_REVIEW";

export type ReasonCode =
  | "SUBMISSION_NOT_CONFIRMED"
  | "PAYMENT_NOT_APPROVED"
  | "ENTRY_MISSING"
  | "ORIGINAL_MISSING"
  | "HASH_MISSING"
  | "DECLARATION_MISSING"
  | "PROMPT_NOT_RELEASED"
  | "UPLOAD_OUTSIDE_WINDOW"
  | "CAPTURE_OUTSIDE_WINDOW"
  | "EXIF_FAIL"
  | "GPS_REQUIRED_MISSING"
  | "DUPLICATE_BLOCKING"
  | "WRONG_EDITION"
  | "WRONG_CONTEST"
  | "CATEGORY_INCOMPATIBLE"
  | "ENTRY_REPLACED"
  | "ENTRY_WITHDRAWN"
  | "ACCREDITATION_MISSING"
  | "PROCESSING_INCOMPLETE"
  | "MIME_INVALID"
  | "EXIF_WARNING"
  | "GPS_OPTIONAL_MISSING"
  | "METADATA_INCOMPLETE"
  | "DUPLICATE_REVIEW"
  | "EXIF_INCONSISTENT"
  | "ACCREDITATION_EXCEPTION"
  | "TIMEZONE_AMBIGUOUS"
  | "ADMIN_EXCEPTION"
  | "FOTORANK_SYNC_DELAY";

export type TechnicalAdmissionDecision = {
  eligible: boolean;
  status: AdmissionStatus;
  blockingReasons: ReasonCode[];
  warningReasons: ReasonCode[];
  manualReviewReasons: ReasonCode[];
  evaluatedAt: string;
  evaluatorVersion: string;
  timelineVersion: number | null;
  rulesVersion: string;
  sourceSubmissionId: string;
  sourceEntryId: string | null;
};

export type AdmissionRuleInput = {
  submissionId: string;
  submissionStatus: string;
  paymentStatus: string;
  registrationStatus: string;
  editionId: string;
  expectedEditionId: string;
  fotorankContestId: string | null;
  expectedContestId: string | null;
  fotorankEntryId: string | null;
  fotorankEntryStatus: string | null;
  originalStorageKey: string | null;
  sha256: string | null;
  validationResult: string | null;
  exifStatus: string | null;
  gpsStatus: string | null;
  gpsMode: "OPTIONAL" | "REQUIRED" | "NOT_REQUIRED" | "GEOFENCE";
  declarationAcceptedAt: Date | null;
  requireDeclaration: boolean;
  promptStatus: string;
  uploadWithinWindow: boolean | null;
  captureWithinWindow: boolean | null;
  captureFailOutsideWindow: boolean;
  uploadExceptionApproved: boolean;
  duplicateBlocking: boolean;
  duplicateReview: boolean;
  accreditationPolicy: AccreditationAdmissionPolicy;
  isCheckedIn: boolean;
  accreditationException: boolean;
  processingComplete: boolean;
  mimeValid: boolean;
  timelineVersion: number | null;
  rulesVersion: string;
  evaluatorVersion: string;
};
