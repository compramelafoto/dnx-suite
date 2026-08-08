import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  isRefundAutoReconcileEnabled,
  isRefundAutoReconcileWritesEnabled,
  parseRefundAutoReconcileEnabled,
  parseRefundAutoReconcileWritesEnabled,
  resolveRefundReconcileMode,
} from "./flags";

const KEYS = [
  "DNX_CLICKATON_REFUND_AUTO_RECONCILE_ENABLED",
  "DNX_CLICKATON_REFUND_AUTO_RECONCILE_WRITES_ENABLED",
  "CLICKATON_TEST_MODE",
  "VITEST",
] as const;

const snapshot = new Map<string, string | undefined>();

afterEach(() => {
  for (const key of KEYS) {
    if (snapshot.has(key)) {
      const prev = snapshot.get(key);
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
      snapshot.delete(key);
    }
  }
});

function setEnv(key: (typeof KEYS)[number], value: string | undefined) {
  if (!snapshot.has(key)) snapshot.set(key, process.env[key]);
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe("refund reconcile flags", () => {
  it("activa en NODE_ENV=test / node:test", () => {
    assert.equal(isRefundAutoReconcileEnabled(), true);
    assert.equal(isRefundAutoReconcileWritesEnabled(), true);
    assert.equal(resolveRefundReconcileMode(), "apply");
  });

  it("default productivo OFF cuando env ausente (parser puro)", () => {
    assert.equal(parseRefundAutoReconcileEnabled(undefined), false);
    assert.equal(parseRefundAutoReconcileWritesEnabled(undefined), false);
    assert.equal(parseRefundAutoReconcileEnabled(""), false);
    assert.equal(parseRefundAutoReconcileWritesEnabled("0"), false);
    assert.equal(parseRefundAutoReconcileWritesEnabled("false"), false);
  });

  it("truthy explícito habilita writes", () => {
    setEnv("DNX_CLICKATON_REFUND_AUTO_RECONCILE_ENABLED", "true");
    setEnv("DNX_CLICKATON_REFUND_AUTO_RECONCILE_WRITES_ENABLED", "1");
    assert.equal(parseRefundAutoReconcileEnabled("true"), true);
    assert.equal(parseRefundAutoReconcileWritesEnabled("1"), true);
  });
});
