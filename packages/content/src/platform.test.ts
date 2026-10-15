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
    assert.deepEqual(platformWhere("compramelafoto"), {
      platform: "compramelafoto",
      workspaceKey: "",
    });
    assert.throws(
      () => platformWhere("infospot" as never),
      (err: unknown) =>
        err instanceof ContentError && err.code === "CONTENT_PLATFORM_REQUIRED"
    );
  });

  it("FOTOFFICE exige la institución: sin ella se leerían los blogs de todas a la vez", () => {
    assert.deepEqual(platformWhere("fotoffice", "ws_sfpr"), {
      platform: "fotoffice",
      workspaceKey: "ws_sfpr",
    });
    for (const vacio of [undefined, null, "", "   "]) {
      assert.throws(
        () => platformWhere("fotoffice", vacio),
        (err: unknown) => err instanceof ContentError && err.code === "CONTENT_WORKSPACE_REQUIRED"
      );
    }
  });

  it("las plataformas con un solo blog rechazan una institución", () => {
    for (const p of ["compramelafoto", "clickaton"] as const) {
      assert.throws(
        () => platformWhere(p, "ws_x"),
        (err: unknown) => err instanceof ContentError && err.code === "CONTENT_WORKSPACE_NOT_ALLOWED"
      );
    }
  });
});
