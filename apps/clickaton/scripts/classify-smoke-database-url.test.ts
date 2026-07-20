import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifySmokeDatabaseUrl,
  isProductionLikeDatabaseUrl,
} from "./lib/classify-smoke-database-url.ts";

describe("classifySmokeDatabaseUrl", () => {
  it("rejects production domain in connection string", () => {
    const url = "postgresql://u:p@db.maratonfotografica.com/neondb";
    const r = classifySmokeDatabaseUrl(url);
    assert.equal(r.classification, "production");
    assert.equal(r.safeForTestSmoke, false);
    assert.equal(isProductionLikeDatabaseUrl(url), true);
  });

  it("accepts local databases", () => {
    const r = classifySmokeDatabaseUrl(
      "postgresql://postgres@127.0.0.1:5432/clickaton_tmp",
    );
    assert.equal(r.classification, "local");
    assert.equal(r.safeForTestSmoke, true);
  });

  it("accepts neon with staging marker in database name", () => {
    const r = classifySmokeDatabaseUrl(
      "postgresql://u:p@ep-abc.us-east-2.aws.neon.tech/clickaton_staging",
    );
    assert.equal(r.classification, "staging");
    assert.equal(r.safeForTestSmoke, true);
    assert.equal(r.reason, "explicit_staging_marker");
  });

  it("accepts neon with test marker in database name", () => {
    const r = classifySmokeDatabaseUrl(
      "postgresql://u:p@ep-abc.us-east-2.aws.neon.tech/clickaton_test",
    );
    assert.equal(r.classification, "test");
    assert.equal(r.safeForTestSmoke, true);
  });

  it("does not treat bare neon.tech as production", () => {
    const url = "postgresql://u:p@ep-abc.us-east-2.aws.neon.tech/neondb";
    const r = classifySmokeDatabaseUrl(url);
    assert.equal(r.classification, "unknown");
    assert.equal(r.safeForTestSmoke, false);
    assert.equal(r.reason, "neon_without_staging_or_test_marker");
    assert.equal(isProductionLikeDatabaseUrl(url), false);
  });

  it("blocks absent url", () => {
    const r = classifySmokeDatabaseUrl(undefined);
    assert.equal(r.classification, "unknown");
    assert.equal(r.safeForTestSmoke, false);
  });
});
