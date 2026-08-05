/**
 * Reglas de API / permisos / transiciones (sin HTTP real).
 * pnpm --filter @repo/db exec tsx ../../apps/fotorank/app/lib/fotorank/admission/admission-api.rules.selfcheck.ts
 */
import assert from "node:assert/strict";
import { isAdmissionReasonCode } from "./reason-codes";
import { isJuryEligibleFromAdmission } from "./state-mapping";

type Role = "participant" | "organizer" | "judge" | "foreign_organizer";

function canAdmit(role: Role, sameContestOrg: boolean): boolean {
  return role === "organizer" && sameContestOrg;
}

function canReviewAdmission(role: Role, sameContestOrg: boolean): boolean {
  return role === "organizer" && sameContestOrg;
}

function canJudgeSeeEntry(admissionStatus: string | null): boolean {
  return isJuryEligibleFromAdmission(admissionStatus);
}

function rejectRequiresReason(reasonCode: string | undefined): boolean {
  return Boolean(reasonCode?.trim()) && isAdmissionReasonCode(reasonCode!);
}

function freezeTargetOk(admissionStatus: string): boolean {
  return admissionStatus === "ADMITTED";
}

function replacementBlockedWhenFrozen(admissionStatus: string): boolean {
  return admissionStatus === "FROZEN_FOR_JURY";
}

assert.equal(canAdmit("participant", true), false);
assert.equal(canAdmit("judge", true), false);
assert.equal(canAdmit("foreign_organizer", false), false);
assert.equal(canAdmit("organizer", true), true);
assert.equal(canReviewAdmission("judge", true), false);

assert.equal(canJudgeSeeEntry(null), false);
assert.equal(canJudgeSeeEntry("ADMITTED"), false);
assert.equal(canJudgeSeeEntry("PENDING_MANUAL_REVIEW"), false);
assert.equal(canJudgeSeeEntry("FROZEN_FOR_JURY"), true);

assert.equal(rejectRequiresReason(""), false);
assert.equal(rejectRequiresReason("ADMISSION_REJECTED"), true);
assert.equal(rejectRequiresReason("FAKE"), false);

assert.equal(freezeTargetOk("ADMITTED"), true);
assert.equal(freezeTargetOk("PENDING_MANUAL_REVIEW"), false);
assert.equal(freezeTargetOk("REJECTED"), false);

assert.equal(replacementBlockedWhenFrozen("FROZEN_FOR_JURY"), true);
assert.equal(replacementBlockedWhenFrozen("ADMITTED"), false);

// Idempotencia conceptual: admit sobre ADMITTED
function admitIdempotent(current: string): "noop" | "apply" | "reject" {
  if (current === "ADMITTED" || current === "FROZEN_FOR_JURY") return "noop";
  if (current === "REJECTED") return "reject";
  return "apply";
}
assert.equal(admitIdempotent("ADMITTED"), "noop");
assert.equal(admitIdempotent("ELIGIBLE"), "apply");
assert.equal(admitIdempotent("REJECTED"), "reject");

console.log("admission-api.rules.selfcheck: OK");
