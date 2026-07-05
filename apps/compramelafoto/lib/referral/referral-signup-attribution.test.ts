import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ReferralProgram } from "@/lib/prisma";
import {
  passesReferralSignupAttributionChecks,
  shouldCreateReferralSignupAttribution,
} from "./referral-signup-attribution";

const referrer = {
  id: 10,
  email: "referrer@test.com",
  mpUserId: "mp-ref",
  mpConnectedAt: new Date("2026-01-01"),
};

describe("passesReferralSignupAttributionChecks", () => {
  it("aprueba caso válido", () => {
    const checks = passesReferralSignupAttributionChecks({
      referrer,
      referredUserId: 20,
      referredUserEmail: "referred@test.com",
      referredUserMpUserId: null,
    });
    assert.equal(shouldCreateReferralSignupAttribution(checks), true);
  });

  it("rechaza self-referral", () => {
    const checks = passesReferralSignupAttributionChecks({
      referrer,
      referredUserId: 10,
      referredUserEmail: "other@test.com",
    });
    assert.equal(checks.notSelf, false);
    assert.equal(shouldCreateReferralSignupAttribution(checks), false);
  });

  it("rechaza email igual", () => {
    const checks = passesReferralSignupAttributionChecks({
      referrer,
      referredUserId: 20,
      referredUserEmail: "referrer@test.com",
    });
    assert.equal(checks.emailDifferent, false);
    assert.equal(shouldCreateReferralSignupAttribution(checks), false);
  });

  it("rechaza referidor sin Mercado Pago", () => {
    const checks = passesReferralSignupAttributionChecks({
      referrer: {
        ...referrer,
        mpUserId: null,
        mpConnectedAt: null,
      },
      referredUserId: 20,
      referredUserEmail: "referred@test.com",
    });
    assert.equal(checks.referrerHasMp, false);
    assert.equal(shouldCreateReferralSignupAttribution(checks), false);
  });

  it("rechaza mismo MP del referidor y referido", () => {
    const checks = passesReferralSignupAttributionChecks({
      referrer,
      referredUserId: 20,
      referredUserEmail: "referred@test.com",
      referredUserMpUserId: "mp-ref",
    });
    assert.equal(checks.mpDifferent, false);
    assert.equal(shouldCreateReferralSignupAttribution(checks), false);
  });
});

describe("ReferralProgram en signup", () => {
  it("enum incluye programas de fotógrafo y organizador", () => {
    assert.equal(ReferralProgram.PHOTOGRAPHER_REFERRAL, "PHOTOGRAPHER_REFERRAL");
    assert.equal(ReferralProgram.ORGANIZER_REFERRAL, "ORGANIZER_REFERRAL");
  });
});
