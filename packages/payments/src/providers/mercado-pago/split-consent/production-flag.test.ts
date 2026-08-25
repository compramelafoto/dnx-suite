import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SPLIT_CONSENT_PRODUCTION_FLAG,
  assertSplitConsentWriteAllowed,
  isSplitConsentProductionEnabled,
} from "./production-flag.js";

describe("split consent production gate", () => {
  it("sandbox is always allowed, flag or not", () => {
    assert.deepEqual(
      assertSplitConsentWriteAllowed({ environment: "sandbox", productionEnabled: false }),
      { ok: true },
    );
  });

  it("production is denied while the flag is off", () => {
    assert.deepEqual(
      assertSplitConsentWriteAllowed({ environment: "production", productionEnabled: false }),
      { ok: false, reason: "PRODUCTION_FLAG_OFF" },
    );
  });

  it("production is allowed once the flag is on", () => {
    assert.deepEqual(
      assertSplitConsentWriteAllowed({ environment: "production", productionEnabled: true }),
      { ok: true },
    );
  });

  /**
   * An environment we do not recognise must never fall through as sandbox: that would turn
   * a typo into a real invitation sent to a real seller.
   */
  it("an unknown environment is denied even with the flag on", () => {
    for (const environment of ["", "prod", "staging", "SANDBOX"]) {
      assert.deepEqual(
        assertSplitConsentWriteAllowed({ environment, productionEnabled: true }),
        { ok: false, reason: "UNKNOWN_ENVIRONMENT" },
        `environment: ${environment}`,
      );
    }
  });
});

describe("isSplitConsentProductionEnabled", () => {
  it("defaults to false when unset", () => {
    assert.equal(isSplitConsentProductionEnabled({} as NodeJS.ProcessEnv), false);
  });

  it("accepts the usual truthy spellings", () => {
    for (const raw of ["1", "true", "TRUE", "yes", "on", " true "]) {
      assert.equal(
        isSplitConsentProductionEnabled({
          [SPLIT_CONSENT_PRODUCTION_FLAG]: raw,
        } as NodeJS.ProcessEnv),
        true,
        `raw: ${raw}`,
      );
    }
  });

  it("anything else stays false", () => {
    for (const raw of ["0", "false", "no", "off", "maybe", ""]) {
      assert.equal(
        isSplitConsentProductionEnabled({
          [SPLIT_CONSENT_PRODUCTION_FLAG]: raw,
        } as NodeJS.ProcessEnv),
        false,
        `raw: ${raw}`,
      );
    }
  });
});
