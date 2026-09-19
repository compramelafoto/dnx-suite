/**
 * Admisión técnica: la apertura de la consigna manda por horario.
 *
 * Antes, una foto se rechazaba con PROMPT_NOT_RELEASED si el cron todavía no
 * había escrito el estado en la base. Eso hacía que la validez de la foto de un
 * competidor dependiera de que un proceso automático hubiera corrido a tiempo.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { evaluateTechnicalAdmission } from "./rules";
import { ADMISSION_ENGINE_VERSION, type AdmissionRuleInput } from "./types";

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
  promptGateOpen: true,
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

test("una consigna lista cuyo portón ya abrió admite la foto aunque el cron no la haya marcado", () => {
  const decision = evaluateTechnicalAdmission({
    ...base,
    promptStatus: "READY",
    promptGateOpen: true,
  });

  assert.equal(decision.blockingReasons.includes("PROMPT_NOT_RELEASED"), false);
  assert.equal(decision.status, "ELIGIBLE");
});

test("con el portón todavía cerrado la foto se sigue bloqueando", () => {
  const decision = evaluateTechnicalAdmission({
    ...base,
    promptStatus: "READY",
    promptGateOpen: false,
  });

  assert.equal(decision.blockingReasons.includes("PROMPT_NOT_RELEASED"), true);
});

test("una consigna en borrador se bloquea aunque el portón esté abierto", () => {
  const decision = evaluateTechnicalAdmission({
    ...base,
    promptStatus: "DRAFT",
    promptGateOpen: true,
  });

  assert.equal(decision.blockingReasons.includes("PROMPT_NOT_RELEASED"), true);
});

test("lo ya liberado por el cron se sigue admitiendo igual que antes", () => {
  const decision = evaluateTechnicalAdmission({ ...base, promptStatus: "RELEASED" });

  assert.equal(decision.blockingReasons.includes("PROMPT_NOT_RELEASED"), false);
  assert.equal(decision.status, "ELIGIBLE");
});
