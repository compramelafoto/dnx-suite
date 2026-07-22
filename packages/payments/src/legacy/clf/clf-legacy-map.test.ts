import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dryRunMapLegacyClfMpUsers,
  mapLegacyClfUserMpToPaymentAccountCandidate,
} from "./map-user-mp-to-payment-account.js";

describe("CLF legacy MP mapper (dry-run)", () => {
  it("maps mpUserId to PaymentAccount candidate without tokens", () => {
    const candidate = mapLegacyClfUserMpToPaymentAccountCandidate({
      userId: 1,
      mpUserId: "TEST_RODRI",
      mpConnectedAt: new Date("2026-01-01"),
      hasAccessToken: true,
      hasRefreshToken: true,
    });
    assert.ok(candidate);
    assert.equal(candidate!.providerUserId, "TEST_RODRI");
    assert.equal(candidate!.credentialReference, null);
    assert.equal(candidate!.originApp, "compramelafoto");
    assert.equal(JSON.stringify(candidate).toLowerCase().includes("token"), false);
  });

  it("detects conflicts and skips missing mpUserId", () => {
    const result = dryRunMapLegacyClfMpUsers([
      {
        userId: 1,
        mpUserId: "TEST_SHARED",
        mpConnectedAt: null,
        hasAccessToken: true,
        hasRefreshToken: false,
      },
      {
        userId: 2,
        mpUserId: "TEST_SHARED",
        mpConnectedAt: null,
        hasAccessToken: true,
        hasRefreshToken: false,
      },
      {
        userId: 3,
        mpUserId: null,
        mpConnectedAt: null,
        hasAccessToken: false,
        hasRefreshToken: false,
      },
    ]);
    assert.equal(result.mapped.length, 2);
    assert.equal(result.skipped.length, 1);
    assert.equal(result.conflicts.length, 1);
    assert.deepEqual(result.conflicts[0]?.userIds, [1, 2]);
  });
});
