import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  transitionPaymentIntent,
  transitionPaymentOrder,
  transitionSplitConsent,
  InvalidTransitionError,
  isTerminalIntent,
} from "../core/index.js";

describe("State machines", () => {
  it("allows PaymentIntent happy path", () => {
    let s = transitionPaymentIntent("DRAFT", "READY");
    s = transitionPaymentIntent(s, "SUBMITTED");
    s = transitionPaymentIntent(s, "SUCCEEDED");
    assert.equal(s, "SUCCEEDED");
    assert.equal(isTerminalIntent(s), true);
  });

  it("rejects invalid intent transition", () => {
    assert.throws(() => transitionPaymentIntent("SUCCEEDED", "DRAFT"), InvalidTransitionError);
  });

  it("allows consent PENDING → ACTIVE and rejects ACTIVE → PENDING", () => {
    assert.equal(transitionSplitConsent("PENDING", "ACTIVE"), "ACTIVE");
    assert.throws(() => transitionSplitConsent("ACTIVE", "PENDING"), InvalidTransitionError);
  });

  it("allows order PAID → REFUNDED", () => {
    assert.equal(transitionPaymentOrder("PAID", "REFUNDED"), "REFUNDED");
  });
});
