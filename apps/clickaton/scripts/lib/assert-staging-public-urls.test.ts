import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertStagingPublicUrls } from "./assert-staging-public-urls";

describe("assertStagingPublicUrls", () => {
  it("rejects production public URLs when staging is expected", () => {
    assert.throws(
      () =>
        assertStagingPublicUrls({
          expectStaging: true,
          env: { CLICKATON_PUBLIC_URL: "https://maratonfotografica.com" },
        }),
      /STAGING URL GUARD ABORTED/,
    );
  });

  it("accepts staging URLs and stays inert outside staging", () => {
    assert.doesNotThrow(() =>
      assertStagingPublicUrls({
        expectStaging: true,
        env: { APP_URL: "https://clickaton-staging.vercel.app" },
      }),
    );
    assert.doesNotThrow(() =>
      assertStagingPublicUrls({
        env: { APP_URL: "https://maratonfotografica.com" },
      }),
    );
  });
});
