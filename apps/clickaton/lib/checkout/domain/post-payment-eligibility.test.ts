import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateCheckInEligibility,
  evaluateKitEligibility,
} from "./post-payment-eligibility";

describe("10D3I-H post-payment eligibility", () => {
  it("blocks check-in until CONFIRMED + APPROVED + credential", () => {
    assert.equal(
      evaluateCheckInEligibility({
        registrationStatus: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
        hasActiveCredential: false,
        alreadyCheckedIn: false,
      }).ok,
      false,
    );
    assert.equal(
      evaluateCheckInEligibility({
        registrationStatus: "CONFIRMED",
        paymentStatus: "APPROVED",
        hasActiveCredential: true,
        alreadyCheckedIn: false,
      }).ok,
      true,
    );
  });

  it("kit eligible only after paid + holds consumed", () => {
    assert.equal(
      evaluateKitEligibility({
        registrationStatus: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
        stockHoldsConsumed: false,
      }).ok,
      false,
    );
    const ok = evaluateKitEligibility({
      registrationStatus: "CONFIRMED",
      paymentStatus: "APPROVED",
      stockHoldsConsumed: true,
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.state, "ELIGIBLE");
  });
});
