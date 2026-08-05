/**
 * Matriz central: resultados técnicos / elegibilidad → decisión de admisión.
 * No auto-rechaza por GPS ausente, EXIF ausente, IA sospechada o metadata eliminada.
 */

import type { EligibilityReasonCode, EligibilityResult } from "../eligibility/types";
import type { ArgraVerificationStatus } from "../eligibility/types";
import {
  ADMISSION_REASON_CODES,
  type AdmissionReasonCode,
} from "./reason-codes";
import type { AdmissionEngineDecision } from "./types";

export type AutoMatrixInput = {
  deviceEval: EligibilityResult;
  territoryEval: EligibilityResult & { territoryStatus?: string };
  captureEval: EligibilityResult;
  argraStatus: ArgraVerificationStatus | null | undefined;
  categoryRequiresArgra: boolean;
  checklistHasBlockingFail: boolean;
  checklistRequiresReview: boolean;
  duplicateSuspected: boolean;
  exifMissing: boolean;
  gpsPresent: boolean;
  softwarePresent: boolean;
};

function mapEligibilityCode(code: EligibilityReasonCode): AdmissionReasonCode | null {
  const map: Partial<Record<EligibilityReasonCode, AdmissionReasonCode>> = {
    PROFESSIONAL_PHONE_NOT_ALLOWED: "PROFESSIONAL_PHONE_NOT_ALLOWED",
    AMATEUR_DRONE_NOT_ALLOWED: "AMATEUR_DRONE_NOT_ALLOWED",
    ARGRA_NUMBER_MISSING: "ARGRA_NUMBER_MISSING",
    ARGRA_VERIFICATION_PENDING: "ARGRA_VERIFICATION_PENDING",
    AERIAL_DRONE_REQUIRED: "AERIAL_DRONE_REQUIRED",
    DEVICE_EXIF_MISMATCH: "DEVICE_EXIF_MISMATCH",
    DEVICE_UNKNOWN: "DEVICE_UNKNOWN",
    EXIF_MISSING: "DEVICE_UNKNOWN",
    TERRITORY_LOCALITY_MISSING: "CAPTURE_LOCATION_MISSING",
    TERRITORY_CONFIRMATION_MISSING: "TERRITORY_DECLARATION_MISSING",
    TERRITORY_GPS_SUPPORTED: "GPS_SUPPORTS_SANTA_FE",
    TERRITORY_GPS_REVIEW: "GPS_OUTSIDE_SANTA_FE",
    TERRITORY_DECLARED_VALID: "GPS_INCONCLUSIVE",
    CAPTURE_WITHIN_WINDOW: "CAPTURE_DATE_WITHIN_WINDOW",
    CAPTURE_DATE_MISSING: "CAPTURE_DATE_MISSING",
    CAPTURE_OUTSIDE_WINDOW: "CAPTURE_DATE_BEFORE_WINDOW",
    CAPTURE_DATE_INVALID: "CAPTURE_DATE_INVALID",
    MANUAL_REVIEW_REQUIRED: "MANUAL_REVIEW_REQUIRED",
  };
  return map[code] ?? null;
}

function uniq(codes: AdmissionReasonCode[]): AdmissionReasonCode[] {
  return [...new Set(codes)];
}

/**
 * Transforma evaluaciones en acción canónica de admisión.
 */
export function evaluateAdmissionAutoMatrix(input: AutoMatrixInput): AdmissionEngineDecision {
  const reasonCodes: AdmissionReasonCode[] = [];

  const pushElig = (evalResult: EligibilityResult) => {
    const mapped = mapEligibilityCode(evalResult.reasonCode);
    if (mapped) reasonCodes.push(mapped);
  };
  pushElig(input.deviceEval);
  pushElig(input.territoryEval);
  pushElig(input.captureEval);

  if (input.duplicateSuspected) reasonCodes.push("DUPLICATE_FILE_SUSPECTED");
  if (input.exifMissing) reasonCodes.push("CAPTURE_DATE_MISSING");
  if (!input.gpsPresent) reasonCodes.push("GPS_INCONCLUSIVE");
  if (input.softwarePresent) reasonCodes.push("EDITING_DECLARATION_REQUIRED");

  if (input.categoryRequiresArgra) {
    if (!input.argraStatus || input.argraStatus === "PENDING_VERIFICATION") {
      reasonCodes.push("ARGRA_VERIFICATION_PENDING");
    } else if (input.argraStatus === "REJECTED") {
      reasonCodes.push("ARGRA_VERIFICATION_REJECTED");
    } else if (input.argraStatus === "EVIDENCE_REQUESTED") {
      reasonCodes.push("ARGRA_VERIFICATION_PENDING");
    }
  }

  const hardRejectDevice =
    input.deviceEval.decision === "NOT_ELIGIBLE" &&
    (input.deviceEval.reasonCode === "AMATEUR_DRONE_NOT_ALLOWED" ||
      input.deviceEval.reasonCode === "AERIAL_DRONE_REQUIRED" ||
      input.deviceEval.reasonCode === "ARGRA_NUMBER_MISSING");

  const hardRejectTerritory = input.territoryEval.decision === "NOT_ELIGIBLE";
  const autoReject =
    input.checklistHasBlockingFail || hardRejectDevice || hardRejectTerritory;

  if (autoReject) {
    const codes = uniq(reasonCodes.length ? reasonCodes : ["FILE_CORRUPTED"]);
    return {
      logicalState: "AUTO_CHECK_FAILED",
      admissionStatus: "REJECTED",
      entryStatusHint: "REJECTED",
      technicalSummaryHint: "TECHNICALLY_REJECTED",
      manualReviewHint: "NONE",
      reasonCodes: codes,
      autoReject: true,
      requiresManualReview: false,
      blocksJury: true,
    };
  }

  const reviewFromDevice = input.deviceEval.decision === "MANUAL_REVIEW_REQUIRED";
  const reviewFromTerritory = input.territoryEval.decision === "REVIEW_REQUIRED";
  const reviewFromCapture =
    input.captureEval.decision === "DATE_MISSING_REVIEW" ||
    input.captureEval.decision === "OUTSIDE_CAPTURE_WINDOW_REVIEW" ||
    input.captureEval.decision === "DATE_INVALID_REVIEW" ||
    input.captureEval.decision === "MANUAL_REVIEW_REQUIRED";
  const reviewFromArgra =
    input.categoryRequiresArgra &&
    input.argraStatus !== "VERIFIED" &&
    input.argraStatus !== "NOT_REQUIRED";
  const reviewFromChecks = input.checklistRequiresReview || input.duplicateSuspected;

  const requiresManualReview =
    reviewFromDevice ||
    reviewFromTerritory ||
    reviewFromCapture ||
    reviewFromArgra ||
    reviewFromChecks ||
    input.exifMissing;

  if (requiresManualReview) {
    if (!reasonCodes.includes("MANUAL_REVIEW_REQUIRED")) {
      reasonCodes.push("MANUAL_REVIEW_REQUIRED");
    }
    return {
      logicalState: "MANUAL_REVIEW_REQUIRED",
      admissionStatus: "PENDING_MANUAL_REVIEW",
      entryStatusHint: "REQUIRES_REVIEW",
      technicalSummaryHint: "REQUIRES_REVIEW",
      manualReviewHint: "PENDING",
      reasonCodes: uniq(reasonCodes),
      autoReject: false,
      requiresManualReview: true,
      blocksJury: true,
    };
  }

  if (!reasonCodes.includes("CAPTURE_DATE_WITHIN_WINDOW") && !input.exifMissing) {
    // ok
  }
  void ADMISSION_REASON_CODES;

  return {
    logicalState: "AUTO_CHECK_PASSED",
    admissionStatus: "ELIGIBLE",
    entryStatusHint: "READY_TO_CONFIRM",
    technicalSummaryHint: "APPROVED",
    manualReviewHint: "NONE",
    reasonCodes: uniq(reasonCodes.length ? reasonCodes : ["CAPTURE_DATE_WITHIN_WINDOW"]),
    autoReject: false,
    requiresManualReview: false,
    blocksJury: true, // aún no admitida formalmente
  };
}

/** Reglas de auto-pass documentadas (Santa Fe). */
export const SANTA_FE_AUTO_PASS_EXAMPLES = [
  "Amateur + celular + territorio + localidad + fecha en período + archivo válido + 1 obra",
  "Profesional + cámara + territorio + período",
  "Aérea + dron identificado + territorio + período",
  "Reportero + ARGRA verificado + dispositivo según preset",
] as const;

export const SANTA_FE_NEVER_AUTO_REJECT = [
  "GPS ausente",
  "EXIF ausente",
  "IA sospechada",
  "Edición sospechada",
  "Reloj incorrecto",
  "Metadata eliminada",
  "Falta de RAW inicial",
] as const;
