import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertPartnersStagingIdentity,
  maskHost,
  resolvePartnersStagingUrl,
} from "./partners-staging-identity.mts";

describe("partners staging identity", () => {
  it("resolvePartnersStagingUrl no usa DATABASE_URL genérica", () => {
    const prev = {
      a: process.env.CLICKATON_STAGING_DATABASE_URL,
      b: process.env.PARTNERS_STAGING_DATABASE_URL,
      c: process.env.COMMUNICATIONS_STAGING_DATABASE_URL,
      d: process.env.DATABASE_URL,
    };
    try {
      delete process.env.CLICKATON_STAGING_DATABASE_URL;
      delete process.env.PARTNERS_STAGING_DATABASE_URL;
      delete process.env.COMMUNICATIONS_STAGING_DATABASE_URL;
      process.env.DATABASE_URL =
        "postgresql://u:p@ep-round-fog-xxx.neon.tech/neondb";
      assert.equal(resolvePartnersStagingUrl(), "");
    } finally {
      process.env.CLICKATON_STAGING_DATABASE_URL = prev.a;
      process.env.PARTNERS_STAGING_DATABASE_URL = prev.b;
      process.env.COMMUNICATIONS_STAGING_DATABASE_URL = prev.c;
      process.env.DATABASE_URL = prev.d;
    }
  });

  it("maskHost sanitiza host Neon", () => {
    assert.match(maskHost("ep-round-fog-a4xgibtv-pooler.us-east-2.aws.neon.tech"), /ep-round-fog/);
    assert.doesNotMatch(
      maskHost("ep-round-fog-a4xgibtv-pooler.us-east-2.aws.neon.tech"),
      /pooler/,
    );
  });

  it("rechaza ep-dawn-dew", async () => {
    const r = await assertPartnersStagingIdentity(
      "postgresql://u:p@ep-dawn-dew-adyr8f1v.neon.tech/neondb",
    );
    assert.equal(r.ok, false);
    assert.match(r.reason, /denylist|production/i);
  });
});
