import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ContentError } from "./errors";
import {
  CONTENT_PLATFORMS,
  assertContentPlatform,
  contentPlatformSchema,
  isContentPlatform,
  platformWhere,
} from "./platform";

describe("content platform", () => {
  it("accepts known lowercase platforms", () => {
    for (const p of CONTENT_PLATFORMS) {
      assert.equal(isContentPlatform(p), true);
      assert.equal(assertContentPlatform(p), p);
      assert.equal(contentPlatformSchema.safeParse(p).success, true);
    }
  });

  it("rejects invalid casing and unknown values", () => {
    assert.equal(isContentPlatform("CLICKATON"), false);
    assert.equal(isContentPlatform("ComprameLaFoto"), false);
    assert.equal(isContentPlatform("infospot"), false);
    assert.equal(isContentPlatform(""), false);
    assert.equal(contentPlatformSchema.safeParse("infospot").success, false);
  });

  it("assertContentPlatform throws CONTENT_PLATFORM_REQUIRED", () => {
    for (const bad of [undefined, null, "", "infospot", "CLICKATON"]) {
      assert.throws(
        () => assertContentPlatform(bad),
        (err: unknown) =>
          err instanceof ContentError && err.code === "CONTENT_PLATFORM_REQUIRED"
      );
    }
  });

  it("platformWhere returns scoped shape", () => {
    assert.deepEqual(platformWhere("compramelafoto"), { platform: "compramelafoto" });
    assert.throws(
      () => platformWhere("infospot" as never),
      (err: unknown) =>
        err instanceof ContentError && err.code === "CONTENT_PLATFORM_REQUIRED"
    );
  });
});
