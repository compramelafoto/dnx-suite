import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getHealthSnapshot } from "../health.js";
import { RENDERER_VERSION } from "../types.js";

describe("template-render-worker health", () => {
  it("returns renderer version and browser flag", async () => {
    const snapshot = await getHealthSnapshot();
    assert.equal(snapshot.rendererVersion, RENDERER_VERSION);
    assert.equal(typeof snapshot.browserAvailable, "boolean");
    assert.equal(typeof snapshot.ok, "boolean");
  });
});
