import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ReferralProgram, Role } from "@/lib/prisma";
import {
  DEFAULT_REFERRAL_PROGRAM,
  inferReferralProgramForReferredUserRole,
  isReferralProgram,
  REFERRAL_PROGRAM_FEE_SHARE,
} from "./referral-program";

describe("referral-program", () => {
  it("default es PHOTOGRAPHER_REFERRAL", () => {
    assert.equal(DEFAULT_REFERRAL_PROGRAM, ReferralProgram.PHOTOGRAPHER_REFERRAL);
  });

  it("isReferralProgram valida valores del enum", () => {
    assert.equal(isReferralProgram(ReferralProgram.PHOTOGRAPHER_REFERRAL), true);
    assert.equal(isReferralProgram(ReferralProgram.ORGANIZER_REFERRAL), true);
    assert.equal(isReferralProgram("INVALID"), false);
  });

  it("inferReferralProgramForReferredUserRole", () => {
    assert.equal(
      inferReferralProgramForReferredUserRole(Role.ORGANIZER),
      ReferralProgram.ORGANIZER_REFERRAL
    );
    assert.equal(
      inferReferralProgramForReferredUserRole(Role.PHOTOGRAPHER),
      ReferralProgram.PHOTOGRAPHER_REFERRAL
    );
  });

  it("REFERRAL_PROGRAM_FEE_SHARE define porcentajes esperados", () => {
    assert.equal(REFERRAL_PROGRAM_FEE_SHARE[ReferralProgram.PHOTOGRAPHER_REFERRAL], 0.5);
    assert.equal(REFERRAL_PROGRAM_FEE_SHARE[ReferralProgram.ORGANIZER_REFERRAL], 0.2);
  });
});
