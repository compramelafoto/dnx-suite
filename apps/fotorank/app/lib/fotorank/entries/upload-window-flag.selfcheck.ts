/**
 * Selfcheck: publicUploadOpen enforced + checklist final labels.
 * pnpm --filter @repo/db exec tsx ../../apps/fotorank/app/lib/fotorank/entries/upload-window-flag.selfcheck.ts
 */
import assert from "node:assert/strict";
import { isPublicUploadOpenFlag, parseUploadPolicy } from "./upload-policy";
import { resolveUploadWindow } from "../participant-experience/upload-window";
import { resolveChecklistFinalResult } from "../../../components/admission/AdmissionChecklistView";

assert.equal(isPublicUploadOpenFlag({ publicUploadOpen: false }), false);
assert.equal(isPublicUploadOpenFlag({ publicUploadOpen: true }), true);
assert.equal(isPublicUploadOpenFlag({}), null);

const now = new Date("2026-08-15T12:00:00.000Z");
const closed = resolveUploadWindow(
  {
    submissionOpensAt: new Date("2026-08-01T00:00:00.000Z"),
    submissionDeadline: new Date("2026-10-01T00:00:00.000Z"),
    registrationOpensAt: null,
    registrationClosesAt: null,
    startAt: null,
    status: "PUBLISHED",
    uploadPolicyJson: { publicUploadOpen: false },
  },
  now,
);
assert.equal(closed.isOpen, false);

const open = resolveUploadWindow(
  {
    submissionOpensAt: new Date("2026-08-01T00:00:00.000Z"),
    submissionDeadline: new Date("2026-10-01T00:00:00.000Z"),
    registrationOpensAt: null,
    registrationClosesAt: null,
    startAt: null,
    status: "PUBLISHED",
    uploadPolicyJson: { publicUploadOpen: true },
  },
  now,
);
assert.equal(open.isOpen, true);

const pol = parseUploadPolicy({ publicUploadOpen: true, draftConfig: false, notes: "ok" });
assert.equal(pol.publicUploadOpen, true);

assert.equal(
  resolveChecklistFinalResult({
    admissionStatus: "ELIGIBLE",
    technicalSummaryStatus: "APPROVED",
  }),
  "LISTA_PARA_ADMITIR",
);
assert.equal(
  resolveChecklistFinalResult({ admissionStatus: "PENDING_MANUAL_REVIEW" }),
  "REQUIERE_REVISION",
);
assert.equal(resolveChecklistFinalResult({ admissionStatus: "REJECTED" }), "RECHAZADA");

console.log(
  JSON.stringify({
    ok: true,
    checks: ["publicUploadOpen_enforced", "checklist_final_labels"],
  }),
);
