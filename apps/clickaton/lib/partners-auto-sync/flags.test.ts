import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  isPartnerBenefitAutoSyncEnabled,
  isPartnerBenefitAutoSyncWritesEnabled,
  resolveAutoSyncProcessMode,
} from "./flags";

const KEYS = [
  "DNX_PARTNER_BENEFIT_AUTO_SYNC_ENABLED",
  "DNX_PARTNER_BENEFIT_AUTO_SYNC_WRITES_ENABLED",
] as const;

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

describe("partner benefit auto-sync flags", () => {
  it("ausente → disabled", () => {
    assert.equal(isPartnerBenefitAutoSyncEnabled(), false);
    assert.equal(resolveAutoSyncProcessMode(), "disabled");
  });

  it("enabled sin writes → shadow", () => {
    process.env.DNX_PARTNER_BENEFIT_AUTO_SYNC_ENABLED = "true";
    assert.equal(resolveAutoSyncProcessMode(), "shadow");
    assert.equal(isPartnerBenefitAutoSyncWritesEnabled(), false);
  });

  it("ambas → apply", () => {
    process.env.DNX_PARTNER_BENEFIT_AUTO_SYNC_ENABLED = "1";
    process.env.DNX_PARTNER_BENEFIT_AUTO_SYNC_WRITES_ENABLED = "yes";
    assert.equal(resolveAutoSyncProcessMode(), "apply");
  });
});
