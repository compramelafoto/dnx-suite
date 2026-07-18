import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectVisualReferenceIntent } from "./detect-visual-reference-intent.js";

describe("detectVisualReferenceIntent", () => {
  it("no solicita en mensajes de cotización normales", () => {
    const r = detectVisualReferenceIntent(
      "Quiero presupuesto para un casamiento en Rosario.",
    );
    assert.equal(r.requested, false);
    assert.equal(r.confidence, 0);
  });

  it("detecta pedido de ejemplos deportivos", () => {
    const r = detectVisualReferenceIntent("Mostrame ejemplos de fotos deportivas.");
    assert.equal(r.requested, true);
    assert.equal(r.niche, "fotografía deportiva");
    assert.ok(r.confidence >= 0.6);
  });

  it("detecta bodas", () => {
    const r = detectVisualReferenceIntent("Quiero ver fotos de casamientos.");
    assert.equal(r.requested, true);
    assert.equal(r.niche, "bodas");
  });
});
