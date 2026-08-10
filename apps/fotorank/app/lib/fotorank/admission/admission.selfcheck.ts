/**
 * Selfcheck admisión técnica — sin DB / sin red.
 * pnpm --filter fotorank run test:admission:selfcheck
 */
import assert from "node:assert/strict";
import {
  ADMISSION_REASON_CODES,
  assertAdmissionReasonCode,
  isAdmissionReasonCode,
  publicMessageForReason,
} from "./reason-codes";
import { evaluateAdmissionAutoMatrix, SANTA_FE_NEVER_AUTO_REJECT } from "./auto-matrix";
import {
  assertAnonymousPayloadClean,
  buildAnonymousJuryCode,
  buildAnonymousJuryPayload,
} from "./anonymity";
import { toLogicalAdmissionState, toPublicParticipantAdmissionView } from "./state-mapping";
import type { EligibilityResult } from "../eligibility/types";

function elig(
  decision: EligibilityResult["decision"],
  reasonCode: EligibilityResult["reasonCode"],
): EligibilityResult {
  return {
    decision,
    reasonCode,
    publicMessage: "pub",
    internalMessage: "int",
    evidence: {},
  };
}

// Reason codes catalog
assert.ok(isAdmissionReasonCode("ADMISSION_APPROVED"));
assert.ok(!isAdmissionReasonCode("NOT_A_REAL_CODE"));
assert.equal(assertAdmissionReasonCode("ENTRY_FROZEN"), "ENTRY_FROZEN");
assert.throws(() => assertAdmissionReasonCode("XYZ"), /REASON_CODE_UNKNOWN/);
assert.ok(publicMessageForReason("ADMISSION_REJECTED").length > 10);
assert.ok(ADMISSION_REASON_CODES.GPS_INCONCLUSIVE.blocksJury === false);
assert.ok(ADMISSION_REASON_CODES.GPS_OUTSIDE_SANTA_FE.recommendedAction === "MANUAL_REVIEW");
assert.ok(SANTA_FE_NEVER_AUTO_REJECT.includes("GPS ausente"));

// Auto-pass amateur-like
const pass = evaluateAdmissionAutoMatrix({
  deviceEval: elig("ELIGIBLE", "AMATEUR_DEVICE_ALLOWED"),
  territoryEval: elig("DECLARED_VALID", "TERRITORY_DECLARED_VALID"),
  captureEval: elig("WITHIN_CAPTURE_WINDOW", "CAPTURE_WITHIN_WINDOW"),
  argraStatus: "NOT_REQUIRED",
  categoryRequiresArgra: false,
  checklistHasBlockingFail: false,
  checklistRequiresReview: false,
  duplicateSuspected: false,
  exifMissing: false,
  gpsPresent: false, // GPS ausente NO auto-rechaza
  softwarePresent: false,
});
assert.equal(pass.logicalState, "AUTO_CHECK_PASSED");
assert.equal(pass.admissionStatus, "ELIGIBLE");
assert.equal(pass.autoReject, false);
assert.ok(pass.reasonCodes.includes("GPS_INCONCLUSIVE"));

// Profesional con celular → revisión
const proPhone = evaluateAdmissionAutoMatrix({
  deviceEval: elig("MANUAL_REVIEW_REQUIRED", "PROFESSIONAL_PHONE_NOT_ALLOWED"),
  territoryEval: elig("DECLARED_VALID", "TERRITORY_DECLARED_VALID"),
  captureEval: elig("WITHIN_CAPTURE_WINDOW", "CAPTURE_WITHIN_WINDOW"),
  argraStatus: "NOT_REQUIRED",
  categoryRequiresArgra: false,
  checklistHasBlockingFail: false,
  checklistRequiresReview: false,
  duplicateSuspected: false,
  exifMissing: false,
  gpsPresent: true,
  softwarePresent: false,
});
assert.equal(proPhone.logicalState, "MANUAL_REVIEW_REQUIRED");
assert.equal(proPhone.admissionStatus, "PENDING_MANUAL_REVIEW");
assert.ok(proPhone.reasonCodes.includes("PROFESSIONAL_PHONE_NOT_ALLOWED"));

// ARGRA pendiente → revisión
const argraPending = evaluateAdmissionAutoMatrix({
  deviceEval: elig("ELIGIBLE", "AMATEUR_DEVICE_ALLOWED"),
  territoryEval: elig("DECLARED_VALID", "TERRITORY_DECLARED_VALID"),
  captureEval: elig("WITHIN_CAPTURE_WINDOW", "CAPTURE_WITHIN_WINDOW"),
  argraStatus: "PENDING_VERIFICATION",
  categoryRequiresArgra: true,
  checklistHasBlockingFail: false,
  checklistRequiresReview: false,
  duplicateSuspected: false,
  exifMissing: false,
  gpsPresent: false,
  softwarePresent: false,
});
assert.equal(argraPending.requiresManualReview, true);
assert.ok(argraPending.reasonCodes.includes("ARGRA_VERIFICATION_PENDING"));

// Fecha ausente → revisión (no reject)
const dateMissing = evaluateAdmissionAutoMatrix({
  deviceEval: elig("ELIGIBLE", "AMATEUR_DEVICE_ALLOWED"),
  territoryEval: elig("DECLARED_VALID", "TERRITORY_DECLARED_VALID"),
  captureEval: elig("DATE_MISSING_REVIEW", "CAPTURE_DATE_MISSING"),
  argraStatus: "NOT_REQUIRED",
  categoryRequiresArgra: false,
  checklistHasBlockingFail: false,
  checklistRequiresReview: false,
  duplicateSuspected: false,
  exifMissing: true,
  gpsPresent: false,
  softwarePresent: false,
});
assert.equal(dateMissing.autoReject, false);
assert.equal(dateMissing.requiresManualReview, true);

// Fecha fuera → revisión
const dateOut = evaluateAdmissionAutoMatrix({
  deviceEval: elig("ELIGIBLE", "AMATEUR_DEVICE_ALLOWED"),
  territoryEval: elig("DECLARED_VALID", "TERRITORY_DECLARED_VALID"),
  captureEval: elig("OUTSIDE_CAPTURE_WINDOW_REVIEW", "CAPTURE_OUTSIDE_WINDOW"),
  argraStatus: "NOT_REQUIRED",
  categoryRequiresArgra: false,
  checklistHasBlockingFail: false,
  checklistRequiresReview: false,
  duplicateSuspected: false,
  exifMissing: false,
  gpsPresent: true,
  softwarePresent: false,
});
assert.equal(dateOut.requiresManualReview, true);

// GPS inconsistente → revisión
const gpsOut = evaluateAdmissionAutoMatrix({
  deviceEval: elig("ELIGIBLE", "AMATEUR_DEVICE_ALLOWED"),
  territoryEval: elig("REVIEW_REQUIRED", "TERRITORY_GPS_REVIEW"),
  captureEval: elig("WITHIN_CAPTURE_WINDOW", "CAPTURE_WITHIN_WINDOW"),
  argraStatus: "NOT_REQUIRED",
  categoryRequiresArgra: false,
  checklistHasBlockingFail: false,
  checklistRequiresReview: false,
  duplicateSuspected: false,
  exifMissing: false,
  gpsPresent: true,
  softwarePresent: false,
});
assert.equal(gpsOut.requiresManualReview, true);
assert.ok(gpsOut.reasonCodes.includes("GPS_OUTSIDE_SANTA_FE"));

// Amateur dron → auto reject permitido
const amateurDrone = evaluateAdmissionAutoMatrix({
  deviceEval: elig("NOT_ELIGIBLE", "AMATEUR_DRONE_NOT_ALLOWED"),
  territoryEval: elig("DECLARED_VALID", "TERRITORY_DECLARED_VALID"),
  captureEval: elig("WITHIN_CAPTURE_WINDOW", "CAPTURE_WITHIN_WINDOW"),
  argraStatus: "NOT_REQUIRED",
  categoryRequiresArgra: false,
  checklistHasBlockingFail: false,
  checklistRequiresReview: false,
  duplicateSuspected: false,
  exifMissing: false,
  gpsPresent: false,
  softwarePresent: false,
});
assert.equal(amateurDrone.autoReject, true);
assert.equal(amateurDrone.admissionStatus, "REJECTED");

// Territorio faltante → reject
const noTerritory = evaluateAdmissionAutoMatrix({
  deviceEval: elig("ELIGIBLE", "AMATEUR_DEVICE_ALLOWED"),
  territoryEval: elig("NOT_ELIGIBLE", "TERRITORY_CONFIRMATION_MISSING"),
  captureEval: elig("WITHIN_CAPTURE_WINDOW", "CAPTURE_WITHIN_WINDOW"),
  argraStatus: "NOT_REQUIRED",
  categoryRequiresArgra: false,
  checklistHasBlockingFail: false,
  checklistRequiresReview: false,
  duplicateSuspected: false,
  exifMissing: false,
  gpsPresent: false,
  softwarePresent: false,
});
assert.equal(noTerritory.autoReject, true);

// State mapping
assert.equal(
  toLogicalAdmissionState({
    status: "REQUIRES_REVIEW",
    technicalSummaryStatus: "REQUIRES_REVIEW",
    manualReviewStatus: "PENDING",
    admissionStatus: "PENDING_MANUAL_REVIEW",
  }),
  "MANUAL_REVIEW_REQUIRED",
);
assert.equal(
  toLogicalAdmissionState({
    status: "CONFIRMED",
    technicalSummaryStatus: "APPROVED",
    manualReviewStatus: "APPROVED",
    admissionStatus: "ADMITTED",
  }),
  "ADMITTED",
);
assert.equal(
  toLogicalAdmissionState({
    status: "CONFIRMED",
    technicalSummaryStatus: "APPROVED",
    manualReviewStatus: "APPROVED",
    admissionStatus: "FROZEN_FOR_JURY",
  }),
  "FROZEN",
);
assert.equal(
  toLogicalAdmissionState({
    status: "REQUIRES_REVIEW",
    technicalSummaryStatus: "REQUIRES_REVIEW",
    manualReviewStatus: "REPLACEMENT_REQUESTED",
    admissionStatus: "PENDING_MANUAL_REVIEW",
  }),
  "REPLACEMENT_ALLOWED",
);

const pub = toPublicParticipantAdmissionView({
  status: "CONFIRMED",
  technicalSummaryStatus: "APPROVED",
  manualReviewStatus: "NONE",
  admissionStatus: "ELIGIBLE",
});
assert.equal(pub.admitted, false);
assert.ok(pub.publicMessage.toLowerCase().includes("admisión") || pub.publicLabel.length > 0);

// Anonymity
const code = buildAnonymousJuryCode({
  contestId: "c1",
  categoryId: "cat1",
  entryId: "e1",
  batchId: "b1",
  categorySlug: "fotografo-amateur",
});
assert.match(code, /^FOTOGR-\d{4}-[0-9A-F]{4}$/);
const payload = buildAnonymousJuryPayload({
  anonymousCode: code,
  categorySlug: "fotografo-amateur",
  categoryName: "Amateur",
  title: "Obra",
  description: null,
  hasJuryAsset: true,
  entryId: "e1",
});
assert.deepEqual(assertAnonymousPayloadClean(payload as unknown as Record<string, unknown>), []);
assert.ok(
  assertAnonymousPayloadClean({ ...payload, email: "x@y.com" } as unknown as Record<string, unknown>).includes(
    "email",
  ),
);

console.log("admission.selfcheck: OK");
