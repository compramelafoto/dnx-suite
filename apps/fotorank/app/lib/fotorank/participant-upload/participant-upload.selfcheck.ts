import assert from "node:assert/strict";
import { SANTA_FE_EN_FOCO_UPLOAD_POLICY_DRAFT } from "../entries/upload-policy";
import { validateFileClientSyncBasics } from "./client-validation";
import { clientValidationMessage, translateUploadError } from "./error-messages";
import {
  buildUploadRequirementsSummary,
  canStartUpload,
  fixtureOpenUploadWindow,
} from "./requirements";
import { mapEntryToUploadFileStatus, presentUploadFileStatus } from "./status-labels";
import { UPLOAD_WIZARD_STEPS } from "./types";

assert.equal(UPLOAD_WIZARD_STEPS.length, 5);

const policy = SANTA_FE_EN_FOCO_UPLOAD_POLICY_DRAFT;

assert.equal(
  validateFileClientSyncBasics({ name: "a.jpg", size: 1000, type: "image/jpeg" }, policy).ok,
  true,
);
assert.equal(
  validateFileClientSyncBasics({ name: "a.png", size: 1000, type: "image/png" }, policy).ok,
  false,
);
assert.equal(
  validateFileClientSyncBasics(
    { name: "a.jpg", size: policy.maxFileSizeBytes + 1, type: "image/jpeg" },
    policy,
  ).ok,
  false,
);
assert.equal(
  validateFileClientSyncBasics({ name: "a.jpg", size: 0, type: "image/jpeg" }, policy).ok,
  false,
);

assert.match(clientValidationMessage("TOO_LARGE"), /peso/i);
assert.match(translateUploadError("UPLOAD_WINDOW_CLOSED"), /no está habilitada/i);
assert.ok(!translateUploadError("UPLOAD_WINDOW_CLOSED").includes("UPLOAD_WINDOW"));

const open = fixtureOpenUploadWindow();
assert.equal(open.isOpen, true);

const closedStart = canStartUpload({
  registrationStatus: "CONFIRMED",
  uploadWindow: { isOpen: false, phase: "not_yet_open", opensAt: null, closesAt: null },
  uploadedCount: 0,
  maxFiles: 1,
});
assert.equal(closedStart.allowed, false);

const okStart = canStartUpload({
  registrationStatus: "CONFIRMED",
  uploadWindow: open,
  uploadedCount: 0,
  maxFiles: 1,
});
assert.equal(okStart.allowed, true);

const req = buildUploadRequirementsSummary({
  contestSlug: "santa-fe-en-foco",
  categoryName: "Fotógrafo Amateur",
  categorySlug: "fotografo-amateur",
  maxFiles: 1,
  uploadPolicyJson: null,
  uploadWindow: open,
  basesHref: "/concursos/santa-fe-en-foco#bases",
});
assert.equal(req.maxFiles, 1);
assert.ok(req.formatsLabel.includes("JPG") || req.formatsLabel.includes("JPEG"));
assert.equal(req.requiresSantaFeEligibility, true);

assert.equal(presentUploadFileStatus("submitted").label, "Enviada");
assert.ok(presentUploadFileStatus("submitted").description.toLowerCase().includes("no implica"));
assert.equal(
  mapEntryToUploadFileStatus({ entryStatus: "CONFIRMED" }),
  "submitted",
);
assert.equal(
  mapEntryToUploadFileStatus({ manualReviewStatus: "REPLACEMENT_REQUESTED" }),
  "needs_correction",
);
assert.equal(mapEntryToUploadFileStatus({ uploadPhase: "uploading" }), "uploading");

console.log("participant-upload.selfcheck: OK");
