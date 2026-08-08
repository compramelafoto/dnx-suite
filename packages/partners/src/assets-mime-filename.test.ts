import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertSafeStorageFilename } from "./assets-mime";

describe("assertSafeStorageFilename", () => {
  it("acepta PNG/WEBP normales", () => {
    assert.equal(assertSafeStorageFilename("logo.png"), "logo.png");
    assert.equal(assertSafeStorageFilename("marca-oscuro.webp"), "marca-oscuro.webp");
  });

  it("acepta nombres con puntos dobles (exports de diseño)", () => {
    assert.equal(assertSafeStorageFilename("logo..png"), "logo.png");
    assert.equal(assertSafeStorageFilename("isotipo..oscuro.webp"), "isotipo.oscuro.webp");
  });

  it("neutraliza path traversal quedándose con el basename", () => {
    assert.equal(assertSafeStorageFilename("../evil.png"), "evil.png");
    assert.equal(assertSafeStorageFilename("C:\\tmp\\logo.webp"), "logo.webp");
  });

  it("rechaza nombres vacíos o solo puntos", () => {
    assert.throws(() => assertSafeStorageFilename(""), /inválido/i);
    assert.throws(() => assertSafeStorageFilename("."), /inválido/i);
    assert.throws(() => assertSafeStorageFilename(".."), /inválido/i);
    assert.throws(() => assertSafeStorageFilename("...."), /inválido/i);
  });
});
