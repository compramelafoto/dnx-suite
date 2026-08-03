import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertClickatonStagingEnvironment } from "./assert-clickaton-staging-environment";

describe("assertClickatonStagingEnvironment", () => {
  it("rejects dawn-dew denylist", () => {
    const r = assertClickatonStagingEnvironment({
      throwOnFail: false,
      databaseUrl:
        "postgresql://u:p@ep-dawn-dew-adyr8f1v-pooler.c-2.us-east-1.aws.neon.tech/neondb",
      publicUrl: "https://clickaton-staging.vercel.app",
      vercelProjectId: "prj_MM6Bkdi8WDDH5P7D5qk66nUFsroa",
      vercelProjectName: "clickaton-staging",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "PRODUCTION_DENYLIST");
  });

  it("rejects production public domain", () => {
    const r = assertClickatonStagingEnvironment({
      throwOnFail: false,
      databaseUrl:
        "postgresql://u:p@ep-round-fog-a4xgibtv-pooler.us-east-1.aws.neon.tech/neondb",
      publicUrl: "https://maratonfotografica.com",
      vercelProjectId: "prj_MM6Bkdi8WDDH5P7D5qk66nUFsroa",
      vercelProjectName: "clickaton-staging",
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "PRODUCTION_DENYLIST");
  });

  it("accepts round-fog + staging project", () => {
    const r = assertClickatonStagingEnvironment({
      throwOnFail: false,
      databaseUrl:
        "postgresql://u:p@ep-round-fog-a4xgibtv-pooler.us-east-1.aws.neon.tech/neondb",
      publicUrl: "https://clickaton-staging.vercel.app",
      vercelProjectId: "prj_MM6Bkdi8WDDH5P7D5qk66nUFsroa",
      vercelProjectName: "clickaton-staging",
    });
    assert.equal(r.ok, true, JSON.stringify(r));
  });
});
