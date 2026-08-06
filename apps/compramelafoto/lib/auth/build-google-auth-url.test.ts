import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildGoogleAuthUrl } from "./build-google-auth-url";

describe("buildGoogleAuthUrl", () => {
  it("incluye role y ref", () => {
    const url = buildGoogleAuthUrl({ role: "PHOTOGRAPHER", ref: "SQZW2CCT" });
    assert.equal(url, "/api/auth/google?role=PHOTOGRAPHER&ref=SQZW2CCT");
  });

  it("omite ref vacío y agrega redirect", () => {
    const url = buildGoogleAuthUrl({
      role: "PHOTOGRAPHER",
      ref: "  ",
      redirect: "/cuantocobro",
    });
    assert.equal(url, "/api/auth/google?role=PHOTOGRAPHER&redirect=%2Fcuantocobro");
  });
});
