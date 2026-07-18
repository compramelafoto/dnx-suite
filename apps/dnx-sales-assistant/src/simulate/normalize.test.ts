import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizePhoneDigits, normalizeSimulateMessageInput } from "./normalize.js";

describe("normalizePhoneDigits", () => {
  it("deja solo dígitos", () => {
    assert.equal(normalizePhoneDigits("+54 9 341 123-4567"), "5493411234567");
  });

  it("conserva una cadena ya normalizada", () => {
    assert.equal(normalizePhoneDigits("5493411234567"), "5493411234567");
  });
});

describe("normalizeSimulateMessageInput", () => {
  it("normaliza from y recorta message", () => {
    const result = normalizeSimulateMessageInput({
      from: "+54 9341-1234567",
      message: "  Hola  ",
    });
    assert.deepEqual(result, {
      from: "5493411234567",
      message: "Hola",
    });
  });
});
