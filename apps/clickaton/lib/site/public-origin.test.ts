import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRODUCTION_SITE_ORIGIN,
  STAGING_SITE_ORIGIN,
  isClickatonProductionAudience,
  isClickatonProductionPublicOrigin,
  isClickatonStagingPublicOrigin,
  resolveClickatonPublicOrigin,
} from "./public-origin";

describe("resolveClickatonPublicOrigin", () => {
  it("prefers CLICKATON_PUBLIC_URL", () => {
    assert.equal(
      resolveClickatonPublicOrigin({
        CLICKATON_PUBLIC_URL: `${STAGING_SITE_ORIGIN}/`,
        APP_URL: PRODUCTION_SITE_ORIGIN,
      }),
      STAGING_SITE_ORIGIN,
    );
  });

  it("uses Vercel staging production URL heuristic", () => {
    assert.equal(
      resolveClickatonPublicOrigin({
        VERCEL_PROJECT_PRODUCTION_URL: "clickaton-staging.vercel.app",
      }),
      STAGING_SITE_ORIGIN,
    );
  });
});

describe("audience helpers", () => {
  it("staging origin is not production audience", () => {
    assert.equal(isClickatonStagingPublicOrigin(STAGING_SITE_ORIGIN), true);
    assert.equal(
      isClickatonProductionAudience({
        CLICKATON_PUBLIC_URL: STAGING_SITE_ORIGIN,
        VERCEL_ENV: "production",
      }),
      false,
    );
  });

  it("production origin is production audience", () => {
    assert.equal(
      isClickatonProductionPublicOrigin(PRODUCTION_SITE_ORIGIN),
      true,
    );
    assert.equal(
      isClickatonProductionAudience({
        CLICKATON_PUBLIC_URL: PRODUCTION_SITE_ORIGIN,
      }),
      true,
    );
  });
});
