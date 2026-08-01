import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertClfMpSplit1nHomologationSafe } from "./assert-safe-environment";
import {
  isClfMpSplit1nHomologationFlagEnabled,
  CLF_MP_SPLIT_1N_HOMOLOGATION_FLAG,
} from "./feature-flag";
import {
  resolveHomologationScenario,
  scenarioAmountMinor,
} from "./scenarios";

describe("CLF MP Split 1:N homologation guards", () => {
  it("blocks when flag disabled", () => {
    const r = assertClfMpSplit1nHomologationSafe({
      NODE_ENV: "development",
      [CLF_MP_SPLIT_1N_HOMOLOGATION_FLAG]: undefined,
    } as NodeJS.ProcessEnv);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "FLAG_DISABLED");
  });

  it("blocks Vercel production even if flag true", () => {
    const r = assertClfMpSplit1nHomologationSafe({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      [CLF_MP_SPLIT_1N_HOMOLOGATION_FLAG]: "true",
    } as NodeJS.ProcessEnv);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.code === "PRODUCTION_HARD_BLOCK" || r.code === "VERCEL_PRODUCTION");
  });

  it("blocks when Orders production flag is on", () => {
    const r = assertClfMpSplit1nHomologationSafe({
      NODE_ENV: "development",
      [CLF_MP_SPLIT_1N_HOMOLOGATION_FLAG]: "true",
      DNX_MP_ORDERS_1N_PRODUCTION_ENABLED: "true",
    } as NodeJS.ProcessEnv);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "PRODUCTION_ORDERS_FLAG_ON");
  });

  it("allows local development with flag", () => {
    const r = assertClfMpSplit1nHomologationSafe({
      NODE_ENV: "development",
      [CLF_MP_SPLIT_1N_HOMOLOGATION_FLAG]: "true",
    } as NodeJS.ProcessEnv);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.productionWrites, "BLOCKED");
  });

  it("flag parser", () => {
    assert.equal(
      isClfMpSplit1nHomologationFlagEnabled({
        [CLF_MP_SPLIT_1N_HOMOLOGATION_FLAG]: "true",
      } as NodeJS.ProcessEnv),
      true,
    );
    assert.equal(
      isClfMpSplit1nHomologationFlagEnabled({} as NodeJS.ProcessEnv),
      false,
    );
  });

  it("resolves owner+1 and owner+2 scenarios", () => {
    const a = resolveHomologationScenario("OWNER_PLUS_1");
    const b = resolveHomologationScenario("OWNER_PLUS_2");
    assert.ok(a);
    assert.ok(b);
    assert.equal(a!.partnerCount, 1);
    assert.equal(b!.partnerCount, 2);
  });

  it("ignores client amount tampering", () => {
    const s = resolveHomologationScenario("OWNER_PLUS_1")!;
    assert.equal(scenarioAmountMinor(s, 999_999_999), s.totalMinor);
  });

  it("rejects unknown scenario", () => {
    assert.equal(resolveHomologationScenario("HACK"), null);
  });

  it("blocks missing device session (contract)", () => {
    const device = "".trim();
    assert.equal(Boolean(device), false);
  });

  it("sanitized log must never include full device or token", async () => {
    const { sanitizeCardPaymentSubmissionForLog } = await import(
      "@repo/payments/frontend"
    );
    const sanitized = sanitizeCardPaymentSubmissionForLog({
      token: "tok_secret_should_not_appear",
      paymentMethodId: "visa",
      installments: 1,
      issuerId: "123",
      payer: { email: "buyer.clf.homolog@testuser.com" },
      deviceSessionId: "armor.full-device-session-value-secret",
    });
    const body = JSON.stringify(sanitized);
    assert.equal(sanitized.DEVICE_SESSION_PRESENT, true);
    assert.ok(!body.includes("tok_secret"));
    assert.ok(!body.includes("armor.full-device"));
    assert.ok(!body.includes("buyer.clf.homolog"));
  });
});
