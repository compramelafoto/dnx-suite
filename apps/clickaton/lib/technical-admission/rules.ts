import type {
  AdmissionRuleInput,
  AdmissionStatus,
  ReasonCode,
  TechnicalAdmissionDecision,
} from "./types";
import { ADMISSION_ENGINE_VERSION } from "./types";

/**
 * Motor determinístico de admisión técnica.
 * No asigna puntuaciones ni decide ganadores.
 */
export function evaluateTechnicalAdmission(
  input: AdmissionRuleInput,
): TechnicalAdmissionDecision {
  const blocking: ReasonCode[] = [];
  const warnings: ReasonCode[] = [];
  const manual: ReasonCode[] = [];

  if (input.submissionStatus === "WITHDRAWN") {
    return decision(input, "WITHDRAWN", false, ["ENTRY_WITHDRAWN"], [], []);
  }
  if (input.submissionStatus === "REPLACED" || input.fotorankEntryStatus === "REPLACED") {
    return decision(input, "REPLACED", false, ["ENTRY_REPLACED"], [], []);
  }
  if (input.submissionStatus !== "CONFIRMED") {
    blocking.push("SUBMISSION_NOT_CONFIRMED");
  }
  if (
    input.registrationStatus !== "CONFIRMED" ||
    (input.paymentStatus !== "APPROVED" && input.paymentStatus !== "NOT_REQUIRED")
  ) {
    blocking.push("PAYMENT_NOT_APPROVED");
  }
  if (input.editionId !== input.expectedEditionId) {
    blocking.push("WRONG_EDITION");
  }
  if (
    input.expectedContestId &&
    input.fotorankContestId &&
    input.fotorankContestId !== input.expectedContestId
  ) {
    blocking.push("WRONG_CONTEST");
  }
  if (!input.fotorankEntryId) blocking.push("ENTRY_MISSING");
  if (!input.originalStorageKey) blocking.push("ORIGINAL_MISSING");
  if (!input.sha256) blocking.push("HASH_MISSING");
  if (!input.mimeValid) blocking.push("MIME_INVALID");
  if (!input.processingComplete) blocking.push("PROCESSING_INCOMPLETE");
  if (input.requireDeclaration && !input.declarationAcceptedAt) {
    blocking.push("DECLARATION_MISSING");
  }
  if (input.promptStatus !== "RELEASED" && input.promptStatus !== "CLOSED") {
    blocking.push("PROMPT_NOT_RELEASED");
  }
  if (input.uploadWithinWindow === false && !input.uploadExceptionApproved) {
    blocking.push("UPLOAD_OUTSIDE_WINDOW");
  }
  if (input.captureWithinWindow === false && input.captureFailOutsideWindow) {
    blocking.push("CAPTURE_OUTSIDE_WINDOW");
  }
  if (input.validationResult === "FAIL" || input.exifStatus === "FAIL") {
    blocking.push("EXIF_FAIL");
  }
  if (
    (input.gpsMode === "REQUIRED" || input.gpsMode === "GEOFENCE") &&
    (input.gpsStatus === "MISSING" || input.gpsStatus === "FAIL" || !input.gpsStatus)
  ) {
    blocking.push("GPS_REQUIRED_MISSING");
  }
  if (input.duplicateBlocking) blocking.push("DUPLICATE_BLOCKING");

  if (input.accreditationPolicy === "REQUIRED" && !input.isCheckedIn) {
    if (input.accreditationException) {
      manual.push("ACCREDITATION_EXCEPTION");
    } else {
      blocking.push("ACCREDITATION_MISSING");
    }
  }
  if (input.accreditationPolicy === "OPTIONAL_WITH_REVIEW" && !input.isCheckedIn) {
    manual.push("ACCREDITATION_MISSING");
  }

  if (input.validationResult === "WARNING" || input.exifStatus === "WARNING") {
    warnings.push("EXIF_WARNING");
  }
  if (input.gpsMode === "OPTIONAL" && (!input.gpsStatus || input.gpsStatus === "MISSING")) {
    warnings.push("GPS_OPTIONAL_MISSING");
  }
  if (input.exifStatus === "PARTIAL" || input.exifStatus === "NOT_AVAILABLE") {
    warnings.push("METADATA_INCOMPLETE");
  }
  if (input.duplicateReview) manual.push("DUPLICATE_REVIEW");
  if (input.validationResult === "MANUAL_REVIEW") manual.push("EXIF_INCONSISTENT");
  if (input.uploadExceptionApproved) manual.push("ADMIN_EXCEPTION");

  let status: AdmissionStatus;
  if (blocking.length > 0) {
    status = "REJECTED";
  } else if (manual.length > 0) {
    status = "PENDING_MANUAL_REVIEW";
  } else {
    status = "ELIGIBLE";
  }

  return decision(
    input,
    status,
    status === "ELIGIBLE",
    blocking,
    warnings,
    manual,
  );
}

function decision(
  input: AdmissionRuleInput,
  status: AdmissionStatus,
  eligible: boolean,
  blockingReasons: ReasonCode[],
  warningReasons: ReasonCode[],
  manualReviewReasons: ReasonCode[],
): TechnicalAdmissionDecision {
  return {
    eligible,
    status,
    blockingReasons,
    warningReasons,
    manualReviewReasons,
    evaluatedAt: new Date().toISOString(),
    evaluatorVersion: input.evaluatorVersion || ADMISSION_ENGINE_VERSION,
    timelineVersion: input.timelineVersion,
    rulesVersion: input.rulesVersion,
    sourceSubmissionId: input.submissionId,
    sourceEntryId: input.fotorankEntryId,
  };
}

export function publicReasonForStatus(status: AdmissionStatus, blocking: ReasonCode[]): string {
  if (status === "ADMITTED" || status === "ELIGIBLE" || status === "FROZEN_FOR_JURY") {
    return "Tu obra fue admitida técnicamente.";
  }
  if (status === "PENDING_MANUAL_REVIEW") {
    return "Tu obra está en revisión técnica.";
  }
  if (status === "WITHDRAWN") return "Retiraste esta obra.";
  if (status === "REPLACED") return "Esta versión fue reemplazada.";
  if (status === "EXCLUDED") return "La obra fue excluida por la organización.";
  if (blocking.includes("PAYMENT_NOT_APPROVED")) {
    return "La inscripción no está confirmada para admisión.";
  }
  if (blocking.includes("DECLARATION_MISSING")) {
    return "Falta aceptar la declaración del reglamento.";
  }
  if (blocking.includes("UPLOAD_OUTSIDE_WINDOW") || blocking.includes("CAPTURE_OUTSIDE_WINDOW")) {
    return "La obra quedó fuera de la ventana permitida.";
  }
  if (blocking.includes("EXIF_FAIL") || blocking.includes("ORIGINAL_MISSING")) {
    return "La obra no cumple requisitos técnicos.";
  }
  return "La obra no fue admitida en esta etapa.";
}

/** Solo entries congeladas son visibles al jurado (Clickatón). */
export function isJuryVisibleAdmissionStatus(status: AdmissionStatus | null | undefined): boolean {
  return status === "FROZEN_FOR_JURY";
}
