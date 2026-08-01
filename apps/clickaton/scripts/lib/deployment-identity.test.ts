import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateDeploymentIdentity } from "./deployment-identity";

describe("evaluateDeploymentIdentity", () => {
  it("PASS staging target", () => {
    const r = evaluateDeploymentIdentity({
      projectName: "clickaton-staging",
      projectId: "prj_MM6Bkdi8WDDH5P7D5qk66nUFsroa",
      gitBranch: "migration-legacy-clf-to-monorepo",
      domains: ["clickaton-staging.vercel.app"],
      expectedProject: "clickaton-staging",
      expectedProductEnvironment: "staging",
      expectedBranch: "migration-legacy-clf-to-monorepo",
      forbiddenDomain: "maratonfotografica.com",
    });
    assert.equal(r.status, "PASS");
  });

  it("FAIL if staging points to production project", () => {
    const r = evaluateDeploymentIdentity({
      projectName: "clickaton-dnxsuite",
      expectedProject: "clickaton-staging",
      expectedProductEnvironment: "staging",
    });
    assert.equal(r.status, "FAIL");
    assert.ok(r.reasons.includes("staging_target_is_production_project"));
  });

  it("FAIL if staging has production domain", () => {
    const r = evaluateDeploymentIdentity({
      projectName: "clickaton-staging",
      domains: ["maratonfotografica.com"],
      expectedProject: "clickaton-staging",
      expectedProductEnvironment: "staging",
    });
    assert.equal(r.status, "FAIL");
  });
});
