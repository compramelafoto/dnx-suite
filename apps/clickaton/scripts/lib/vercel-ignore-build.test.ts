import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideProductionIgnoreBuild,
  exitCodeForDecision,
} from "./vercel-ignore-build";

describe("decideProductionIgnoreBuild", () => {
  it("continues build only for main", () => {
    assert.equal(decideProductionIgnoreBuild("main"), "continue_build");
    assert.equal(exitCodeForDecision("continue_build"), 1);
  });

  it("skips WIP migration branch", () => {
    assert.equal(
      decideProductionIgnoreBuild("migration-legacy-clf-to-monorepo"),
      "skip_build",
    );
    assert.equal(exitCodeForDecision("skip_build"), 0);
  });

  it("skips clickaton-staging branch on production project", () => {
    assert.equal(decideProductionIgnoreBuild("clickaton-staging"), "skip_build");
  });

  it("skips empty ref", () => {
    assert.equal(decideProductionIgnoreBuild(""), "skip_build");
    assert.equal(decideProductionIgnoreBuild(undefined), "skip_build");
  });
});
