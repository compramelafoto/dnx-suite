import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canPartnerPerform,
  canTransitionPartnerConnection,
  createEmptyProductionReadinessInput,
  createSimulatedCompleteReadinessInput,
  evaluateClickatonProductionPaymentReadiness,
  FORBIDDEN_PARTNER_CONNECTION_TRANSITIONS,
  PARTNER_PERMISSION_MATRIX,
  CLICKATON_PRODUCTION_TARGET_BPS,
  CLICKATON_STAGING_TEST_AGREEMENT_SCOPE,
} from "./index.js";

describe("10D3I-I0 partner onboarding governance", () => {
  it("blocks percentage / production / token visibility for partners", () => {
    for (const role of ["DANIEL_PARTNER", "RODRIGO_PARTNER", "TAMARA_PARTNER"] as const) {
      assert.equal(canPartnerPerform(role, "modify_percentages"), false);
      assert.equal(canPartnerPerform(role, "publish_distribution_version"), false);
      assert.equal(canPartnerPerform(role, "activate_production"), false);
      assert.equal(canPartnerPerform(role, "view_access_token"), false);
      assert.equal(canPartnerPerform(role, "view_full_receiver_id"), false);
      assert.equal(canPartnerPerform(role, "view_global_settlements"), false);
      assert.equal(canPartnerPerform(role, "connect_own_account"), true);
      assert.equal(canPartnerPerform(role, "revoke_own_account"), true);
    }
  });

  it("allows finance owner to publish but never view tokens", () => {
    assert.equal(canPartnerPerform("DNX_FINANCE_OWNER", "publish_distribution_version"), true);
    assert.equal(canPartnerPerform("DNX_FINANCE_OWNER", "modify_percentages"), true);
    assert.equal(canPartnerPerform("DNX_FINANCE_OWNER", "view_access_token"), false);
    assert.equal(canPartnerPerform("DNX_FINANCE_OWNER", "view_full_receiver_id"), false);
    assert.equal(canPartnerPerform("SYSTEM", "view_full_receiver_id"), true);
    assert.equal(canPartnerPerform("SYSTEM", "view_access_token"), false);
  });

  it("permission matrix never grants access_token to any role", () => {
    for (const role of Object.keys(PARTNER_PERMISSION_MATRIX.view_access_token) as Array<
      keyof typeof PARTNER_PERMISSION_MATRIX.view_access_token
    >) {
      assert.equal(PARTNER_PERMISSION_MATRIX.view_access_token[role], false);
    }
  });

  it("allows valid connection transitions and rejects skip-to-ACTIVE", () => {
    assert.equal(canTransitionPartnerConnection("NOT_CONNECTED", "OAUTH_PENDING"), true);
    assert.equal(canTransitionPartnerConnection("OAUTH_PENDING", "CONNECTED_UNVERIFIED"), true);
    assert.equal(canTransitionPartnerConnection("CONSENT_PENDING", "ACTIVE"), true);
    for (const t of FORBIDDEN_PARTNER_CONNECTION_TRANSITIONS) {
      assert.equal(canTransitionPartnerConnection(t.from, t.to), false);
    }
  });

  it("empty readiness fails closed with production flags OFF", () => {
    const result = evaluateClickatonProductionPaymentReadiness(
      createEmptyProductionReadinessInput(),
    );
    assert.equal(result.productionFlagsOff, true);
    assert.equal(result.legacyCheckoutAvailable, true);
    assert.equal(result.readyForDryRun, false);
    assert.equal(result.readyForMicroTransaction, false);
    assert.equal(result.readyForCutover, false);
    assert.ok(result.blockers.includes("ownerDecisionDefined"));
    assert.ok(result.blockers.includes("oauthPartnerPathReady"));
    assert.ok(result.blockers.includes("ownerConnected"));
    assert.ok(result.blockers.includes("partnerRodrigoConnected"));
    assert.ok(result.blockers.includes("partnerTamaraConnected"));
    assert.deepEqual(result.targetBps, CLICKATON_PRODUCTION_TARGET_BPS);
  });

  it("simulated complete readiness allows dry-run only", () => {
    const result = evaluateClickatonProductionPaymentReadiness(
      createSimulatedCompleteReadinessInput(),
    );
    assert.equal(result.blockers.length, 0);
    assert.equal(result.readyForDryRun, true);
    assert.equal(result.readyForMicroTransaction, false);
    assert.equal(result.readyForCutover, false);
    assert.equal(result.ownerVerified, true);
    assert.equal(result.partnerRodrigoConsentActive, true);
    assert.equal(result.partnerTamaraConsentActive, true);
    assert.equal(result.totalBpsValid, true);
  });

  it("rejects incomplete consent even if connected", () => {
    const input = createSimulatedCompleteReadinessInput();
    input.rodriConsentActive = false;
    input.rodriStatus = "CONSENT_PENDING";
    const result = evaluateClickatonProductionPaymentReadiness(input);
    assert.equal(result.partnerRodrigoConsentActive, false);
    assert.ok(result.blockers.includes("partnerRodrigoConsentActive"));
    assert.equal(result.readyForDryRun, false);
  });

  it("rejects invalid total bps", () => {
    const input = createSimulatedCompleteReadinessInput();
    input.totalBps = 9999;
    const result = evaluateClickatonProductionPaymentReadiness(input);
    assert.equal(result.totalBpsValid, false);
    assert.ok(result.blockers.includes("totalBpsValid"));
  });

  it("does not mutate staging TEST agreement scope constant", () => {
    assert.equal(CLICKATON_STAGING_TEST_AGREEMENT_SCOPE.scopeId, "partners-10d3i-e");
    assert.equal(CLICKATON_STAGING_TEST_AGREEMENT_SCOPE.scopeType, "STAGING_TEST");
  });

  it("blocks production when flags are unexpectedly ON", () => {
    const input = createSimulatedCompleteReadinessInput();
    input.productionFlagsOff = false;
    const result = evaluateClickatonProductionPaymentReadiness(input);
    assert.ok(result.blockers.includes("productionFlagsOff"));
    assert.equal(result.readyForDryRun, false);
  });
});
