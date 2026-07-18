import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isReviewLabEnabled } from "./enabled.js";

describe("isReviewLabEnabled", () => {
  it("deshabilitado por defecto", () => {
    assert.equal(isReviewLabEnabled({}), false);
    assert.equal(isReviewLabEnabled({ NODE_ENV: "development" }), false);
  });

  it("bloqueado en production aunque el flag esté activo", () => {
    assert.equal(
      isReviewLabEnabled({
        NODE_ENV: "production",
        DNX_SALES_ASSISTANT_REVIEW_LAB: "true",
      }),
      false,
    );
  });

  it("activo solo con flag explícito y no production", () => {
    assert.equal(
      isReviewLabEnabled({
        NODE_ENV: "development",
        DNX_SALES_ASSISTANT_REVIEW_LAB: "true",
      }),
      true,
    );
    assert.equal(
      isReviewLabEnabled({
        NODE_ENV: "test",
        DNX_SALES_ASSISTANT_REVIEW_LAB: "1",
      }),
      true,
    );
  });
});
