import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertOrders1nStagingCreateAllowed,
  isOrders1nStagingFlagEnabled,
  ORDERS_1N_STAGING_FLAG,
} from "./orders-1n-flag.js";

const ready = {
  flagEnabled: true,
  environment: "sandbox" as const,
  confirmStaging: true,
  confirmOrdersTest: true,
  accessTokenPresent: true,
  accessTokenSandboxEligible: true,
  ownerUserIdPresent: true,
  receiver1Present: true,
  receiver2Present: true,
  paymentTokenPresent: true,
  deviceIdPresent: true,
};

describe("Orders 1:N staging flag", () => {
  it("defaults off", () => {
    const prev = process.env[ORDERS_1N_STAGING_FLAG];
    delete process.env[ORDERS_1N_STAGING_FLAG];
    assert.equal(isOrders1nStagingFlagEnabled(), false);
    if (prev !== undefined) process.env[ORDERS_1N_STAGING_FLAG] = prev;
  });

  it("allows create only when all gates pass", () => {
    assert.equal(assertOrders1nStagingCreateAllowed(ready).ok, true);
  });

  it("blocks flag off / production / missing token / missing confirms", () => {
    assert.equal(
      assertOrders1nStagingCreateAllowed({ ...ready, flagEnabled: false }).ok,
      false,
    );
    assert.equal(
      assertOrders1nStagingCreateAllowed({ ...ready, environment: "production" }).ok,
      false,
    );
    assert.equal(
      assertOrders1nStagingCreateAllowed({ ...ready, paymentTokenPresent: false }).ok,
      false,
    );
    assert.equal(
      assertOrders1nStagingCreateAllowed({ ...ready, confirmStaging: false }).ok,
      false,
    );
    assert.equal(
      assertOrders1nStagingCreateAllowed({ ...ready, receiver2Present: false }).ok,
      false,
    );
  });
});
