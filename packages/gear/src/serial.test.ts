import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makesLookCompatible, normalizeGearSerial } from "./serial";

describe("normalizeGearSerial", () => {
  it("unifica guiones, espacios, mayúsculas y ceros a la izquierda", () => {
    assert.equal(normalizeGearSerial("0123-456"), "123456");
    assert.equal(normalizeGearSerial("123 456"), "123456");
    assert.equal(normalizeGearSerial("ab12cd"), "AB12CD");
  });

  it("acepta números", () => {
    assert.equal(normalizeGearSerial(2051234), "2051234");
  });

  it("descarta series de relleno o muy cortas", () => {
    assert.equal(normalizeGearSerial("0000000000"), null);
    assert.equal(normalizeGearSerial("012"), null);
    assert.equal(normalizeGearSerial("  "), null);
    assert.equal(normalizeGearSerial(null), null);
  });
});

describe("makesLookCompatible", () => {
  it("tolera variantes de la misma marca", () => {
    assert.equal(makesLookCompatible("Canon", "CANON INC."), true);
    assert.equal(makesLookCompatible("NIKON CORPORATION", "Nikon"), true);
  });

  it("marca distinta", () => {
    assert.equal(makesLookCompatible("Canon", "Sony"), false);
  });
});
