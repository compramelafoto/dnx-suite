import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decodeGoogleOAuthState,
  encodeGoogleOAuthState,
} from "./google-oauth-state";

describe("google-oauth-state", () => {
  it("mantiene rol plano sin extras (compat)", () => {
    assert.equal(encodeGoogleOAuthState({ role: "PHOTOGRAPHER" }), "PHOTOGRAPHER");
    assert.deepEqual(decodeGoogleOAuthState("ORGANIZER"), { role: "ORGANIZER" });
  });

  it("mantiene CC:redirect sin referido (compat)", () => {
    assert.equal(
      encodeGoogleOAuthState({ role: "PHOTOGRAPHER", redirect: "/cuantocobro" }),
      "CC:/cuantocobro"
    );
    assert.deepEqual(decodeGoogleOAuthState("CC:/cuantocobro/dashboard"), {
      role: "PHOTOGRAPHER",
      redirect: "/cuantocobro/dashboard",
    });
  });

  it("roundtrip con ref + training", () => {
    const encoded = encodeGoogleOAuthState({
      role: "PHOTOGRAPHER",
      ref: "SQZW2CCT",
      sourceType: "TRAINING",
      sourceEntityId: 12,
    });
    assert.match(encoded, /^v1\./);
    assert.deepEqual(decodeGoogleOAuthState(encoded), {
      role: "PHOTOGRAPHER",
      ref: "SQZW2CCT",
      sourceType: "TRAINING",
      sourceEntityId: 12,
    });
  });

  it("combina ref con redirect cuantocobro", () => {
    const encoded = encodeGoogleOAuthState({
      role: "PHOTOGRAPHER",
      ref: "ABC123",
      redirect: "/cuantocobro",
    });
    assert.deepEqual(decodeGoogleOAuthState(encoded), {
      role: "PHOTOGRAPHER",
      ref: "ABC123",
      redirect: "/cuantocobro",
    });
  });

  it("state inválido cae a PHOTOGRAPHER", () => {
    assert.deepEqual(decodeGoogleOAuthState("v1.%%%"), { role: "PHOTOGRAPHER" });
  });
});
