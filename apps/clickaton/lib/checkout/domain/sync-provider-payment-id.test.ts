import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideProviderPaymentIdSync } from "./sync-provider-payment-id";

describe("decideProviderPaymentIdSync", () => {
  it("null local + remote válido → persist", () => {
    const d = decideProviderPaymentIdSync({
      localProviderPaymentId: null,
      remoteProviderPaymentId: "171556178494",
    });
    assert.deepEqual(d, {
      action: "persist",
      providerPaymentId: "171556178494",
    });
  });

  it("mismo ID → noop", () => {
    const d = decideProviderPaymentIdSync({
      localProviderPaymentId: "171556178494",
      remoteProviderPaymentId: "171556178494",
    });
    assert.deepEqual(d, { action: "noop", reason: "same_id" });
  });

  it("ID distinto → manual_review", () => {
    const d = decideProviderPaymentIdSync({
      localProviderPaymentId: "111",
      remoteProviderPaymentId: "222",
    });
    assert.deepEqual(d, {
      action: "manual_review",
      reason: "provider_payment_id_conflict",
      local: "111",
      remote: "222",
    });
  });

  it("remote inválido → noop", () => {
    const d = decideProviderPaymentIdSync({
      localProviderPaymentId: null,
      remoteProviderPaymentId: "pref_abc",
    });
    assert.deepEqual(d, { action: "noop", reason: "missing_remote" });
  });
});
