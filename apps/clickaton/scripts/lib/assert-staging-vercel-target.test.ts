import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLICKATON_PRODUCTION_PROJECT_ID,
  CLICKATON_STAGING_PROJECT_ID,
  assertStagingVercelTarget,
} from "./assert-staging-vercel-target";

describe("assertStagingVercelTarget", () => {
  it("aborts production project name", () => {
    const r = assertStagingVercelTarget({
      cwd: "/tmp/nonexistent-clickaton-cwd",
      envProjectName: "clickaton-dnxsuite",
      envProjectId: CLICKATON_PRODUCTION_PROJECT_ID,
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.match(r.abortMessage, /DEPLOY ABORTED: expected clickaton-staging/);
      assert.match(r.abortMessage, /clickaton-dnxsuite/);
    }
  });

  it("passes staging project id via env", () => {
    const r = assertStagingVercelTarget({
      cwd: "/tmp/nonexistent-clickaton-cwd",
      envProjectName: "clickaton-staging",
      envProjectId: CLICKATON_STAGING_PROJECT_ID,
    });
    assert.equal(r.ok, true);
  });

  it("aborts unexpected project id", () => {
    const r = assertStagingVercelTarget({
      cwd: "/tmp/nonexistent-clickaton-cwd",
      envProjectName: "clickaton-staging",
      envProjectId: "prj_WRONGPROJECTID000000000000",
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.match(r.abortMessage, /DEPLOY ABORTED/);
    }
  });
});
