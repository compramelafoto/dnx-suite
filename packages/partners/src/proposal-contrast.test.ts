import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePlateTreatment } from "./proposal-contrast";

describe("decisión de placa según el logo", () => {
  it("logo claro sobre transparente va en placa oscura", () => {
    // DVV: casi blanco. Sobre fondo claro desaparece.
    const r = resolvePlateTreatment({ meanLuminance: 0.92, hasAlpha: true });
    assert.equal(r.plate, "DARK");
  });

  it("logo oscuro sobre transparente va en placa clara", () => {
    const r = resolvePlateTreatment({ meanLuminance: 0.14, hasAlpha: true });
    assert.equal(r.plate, "LIGHT");
  });

  it("logo de luminancia media va en placa clara por defecto", () => {
    const r = resolvePlateTreatment({ meanLuminance: 0.5, hasAlpha: true });
    assert.equal(r.plate, "LIGHT");
  });

  it("logo sin transparencia trae su propio fondo y no lleva placa", () => {
    const r = resolvePlateTreatment({ meanLuminance: 0.3, hasAlpha: false });
    assert.equal(r.plate, "NONE");
  });

  it("explica el motivo en español", () => {
    const r = resolvePlateTreatment({ meanLuminance: 0.92, hasAlpha: true });
    assert.match(r.reason, /claro/i);
  });

  it("rechaza luminancia fuera de rango", () => {
    assert.throws(() => resolvePlateTreatment({ meanLuminance: 1.4, hasAlpha: true }));
    assert.throws(() => resolvePlateTreatment({ meanLuminance: -0.1, hasAlpha: true }));
  });
});
