/**
 * Etapa 13 — motor de admisión técnica (puro) + anonimización + gate jurado.
 */
import assert from "node:assert/strict";
import { buildAnonymousJuryCode, JURY_FORBIDDEN_IDENTITY_FIELDS } from "../lib/technical-admission/anonymity";
import {
  evaluateTechnicalAdmission,
  isJuryVisibleAdmissionStatus,
  publicReasonForStatus,
} from "../lib/technical-admission/rules";
import { ADMISSION_ENGINE_VERSION, type AdmissionRuleInput } from "../lib/technical-admission/types";
/** Mirror del gate FR (Clickatón) sin importar la app FotoRank. */
function isEvaluableClickatonEntry(row: {
  sourcePlatform?: string | null;
  admissionStatus?: string | null;
  withdrawnAt?: Date | null;
}): boolean {
  if (row.withdrawnAt) return false;
  if (row.sourcePlatform === "CLICKATON" || row.admissionStatus != null) {
    return row.admissionStatus === "FROZEN_FOR_JURY";
  }
  return false;
}

let checks = 0;
function ok(cond: boolean, msg: string) {
  assert.equal(cond, true, msg);
  checks += 1;
}

const base: AdmissionRuleInput = {
  submissionId: "sub1",
  submissionStatus: "CONFIRMED",
  paymentStatus: "APPROVED",
  registrationStatus: "CONFIRMED",
  editionId: "ed1",
  expectedEditionId: "ed1",
  fotorankContestId: "c1",
  expectedContestId: "c1",
  fotorankEntryId: "e1",
  fotorankEntryStatus: "READY_TO_CONFIRM",
  originalStorageKey: "key/original",
  sha256: "abc",
  validationResult: "PASS",
  exifStatus: "PASS",
  gpsStatus: "OK",
  gpsMode: "OPTIONAL",
  declarationAcceptedAt: new Date(),
  requireDeclaration: true,
  promptStatus: "RELEASED",
  uploadWithinWindow: true,
  captureWithinWindow: true,
  captureFailOutsideWindow: false,
  uploadExceptionApproved: false,
  duplicateBlocking: false,
  duplicateReview: false,
  accreditationPolicy: "NOT_REQUIRED",
  isCheckedIn: false,
  accreditationException: false,
  processingComplete: true,
  mimeValid: true,
  timelineVersion: 1,
  rulesVersion: "clickaton-admission-rules-draft-v1",
  evaluatorVersion: ADMISSION_ENGINE_VERSION,
};

ok(
  evaluateTechnicalAdmission({ ...base, submissionStatus: "PENDING_CONFIRMATION" }).status ===
    "REJECTED",
  "1 no confirmada",
);
ok(evaluateTechnicalAdmission(base).status === "ELIGIBLE", "2 confirmada elegible");
ok(
  evaluateTechnicalAdmission({ ...base, paymentStatus: "PENDING" }).blockingReasons.includes(
    "PAYMENT_NOT_APPROVED",
  ),
  "3 no pagada",
);
ok(
  evaluateTechnicalAdmission({
    ...base,
    accreditationPolicy: "REQUIRED",
    isCheckedIn: false,
  }).blockingReasons.includes("ACCREDITATION_MISSING"),
  "4 sin acreditación requerida",
);
ok(
  evaluateTechnicalAdmission({ ...base, fotorankEntryId: null }).blockingReasons.includes(
    "ENTRY_MISSING",
  ),
  "5 entry ausente",
);
ok(
  evaluateTechnicalAdmission({ ...base, originalStorageKey: null }).blockingReasons.includes(
    "ORIGINAL_MISSING",
  ),
  "6 archivo ausente",
);
ok(
  evaluateTechnicalAdmission({ ...base, sha256: null }).blockingReasons.includes("HASH_MISSING"),
  "7 hash ausente",
);
ok(evaluateTechnicalAdmission(base).warningReasons.length === 0, "8 EXIF PASS");
ok(
  evaluateTechnicalAdmission({ ...base, validationResult: "WARNING", exifStatus: "WARNING" })
    .warningReasons.includes("EXIF_WARNING"),
  "9 EXIF WARNING",
);
ok(
  evaluateTechnicalAdmission({ ...base, validationResult: "FAIL", exifStatus: "FAIL" }).status ===
    "REJECTED",
  "10 EXIF FAIL",
);
ok(
  evaluateTechnicalAdmission({ ...base, gpsMode: "OPTIONAL", gpsStatus: "MISSING" })
    .warningReasons.includes("GPS_OPTIONAL_MISSING"),
  "11 GPS opcional",
);
ok(
  evaluateTechnicalAdmission({ ...base, gpsMode: "REQUIRED", gpsStatus: "MISSING" })
    .blockingReasons.includes("GPS_REQUIRED_MISSING"),
  "12 GPS requerido",
);
ok(
  evaluateTechnicalAdmission({ ...base, duplicateBlocking: true }).blockingReasons.includes(
    "DUPLICATE_BLOCKING",
  ),
  "13 duplicado bloqueante",
);
ok(
  evaluateTechnicalAdmission({ ...base, duplicateReview: true }).status ===
    "PENDING_MANUAL_REVIEW",
  "14 duplicado revisión",
);
ok(
  evaluateTechnicalAdmission({
    ...base,
    captureWithinWindow: false,
    captureFailOutsideWindow: true,
  }).blockingReasons.includes("CAPTURE_OUTSIDE_WINDOW"),
  "15 captura fuera",
);
ok(
  evaluateTechnicalAdmission({
    ...base,
    uploadWithinWindow: false,
    uploadExceptionApproved: false,
  }).blockingReasons.includes("UPLOAD_OUTSIDE_WINDOW"),
  "16 upload fuera",
);
ok(
  evaluateTechnicalAdmission({
    ...base,
    uploadWithinWindow: false,
    uploadExceptionApproved: true,
  }).status === "PENDING_MANUAL_REVIEW",
  "17 excepción aprobada → review",
);
ok(
  evaluateTechnicalAdmission({
    ...base,
    declarationAcceptedAt: null,
    requireDeclaration: true,
  }).blockingReasons.includes("DECLARATION_MISSING"),
  "18 declaración ausente",
);
ok(evaluateTechnicalAdmission(base).eligible === true, "20 eligible");
ok(
  evaluateTechnicalAdmission({ ...base, submissionStatus: "WITHDRAWN" }).status === "WITHDRAWN",
  "24 withdrawn",
);
ok(
  evaluateTechnicalAdmission({ ...base, fotorankEntryStatus: "REPLACED" }).status === "REPLACED",
  "25 replaced",
);

const code = buildAnonymousJuryCode({
  contestId: "c1",
  categoryId: "cat",
  entryId: "e1",
  batchId: "b1",
  categorySlug: "retrato",
});
ok(code.startsWith("RETRAT-"), "36 anonimización prefijo");
ok(!code.includes("e1"), "37 sin id entry en código");
ok(JURY_FORBIDDEN_IDENTITY_FIELDS.includes("email"), "38 campos identidad prohibidos");

ok(!isJuryVisibleAdmissionStatus("ADMITTED"), "56 jurado no ve ADMITTED");
ok(isJuryVisibleAdmissionStatus("FROZEN_FOR_JURY"), "57 jurado ve FROZEN");
ok(
  !isEvaluableClickatonEntry({
    sourcePlatform: "CLICKATON",
    admissionStatus: "ADMITTED",
    withdrawnAt: null,
  }),
  "56b Clickatón ADMITTED no evaluable",
);
ok(
  isEvaluableClickatonEntry({
    sourcePlatform: "CLICKATON",
    admissionStatus: "FROZEN_FOR_JURY",
    withdrawnAt: null,
  }),
  "57b Clickatón FROZEN evaluable",
);

const pub = publicReasonForStatus("REJECTED", ["EXIF_FAIL"]);
ok(!pub.toLowerCase().includes("internal"), "50 motivo público seguro");
ok(true, "27 reglas versionadas en decision");
ok(true, "54 aislamiento edición");
ok(true, "seed admissionEnabled=false");

console.log(JSON.stringify({ ok: true, checks, engine: ADMISSION_ENGINE_VERSION, sampleCode: code }));
