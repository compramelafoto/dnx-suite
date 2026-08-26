import { test } from "node:test";
import assert from "node:assert/strict";
import { mmToPt } from "../document/units";
import { evaluateQrLegibility } from "./qr";

const TOKEN_CORTO = "https://fotoffice.com/c/AB12CD34";

test("un QR de 26 mm con un token corto es legible", () => {
  const r = evaluateQrLegibility({
    payload: TOKEN_CORTO,
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: mmToPt(26),
    medium: "PRINT",
    dpi: 300,
  });
  assert.equal(r.level, "OK");
  assert.ok(r.moduleSizeMm && r.moduleSizeMm > 0.5);
});

test("el mismo QR en 8 mm bloquea la publicacion", () => {
  const r = evaluateQrLegibility({
    payload: TOKEN_CORTO,
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: mmToPt(8),
    medium: "PRINT",
    dpi: 300,
  });
  assert.equal(r.level, "BLOCKS_PUBLISH");
  assert.match(r.message, /chico|pequeñ/i);
});

test("un tamano intermedio avisa sin bloquear", () => {
  const r = evaluateQrLegibility({
    payload: TOKEN_CORTO,
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: mmToPt(19),
    medium: "PRINT",
    dpi: 300,
  });
  assert.equal(r.level, "WARNING");
});

test("mas informacion codificada empeora la legibilidad en el mismo tamano", () => {
  const corto = evaluateQrLegibility({
    payload: TOKEN_CORTO,
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: mmToPt(26),
    medium: "PRINT",
    dpi: 300,
  });
  const largo = evaluateQrLegibility({
    payload:
      "https://fotoffice.com/carnet/verificar?socio=128&token=abcdefghijklmnopqrstuvwxyz012345&emitido=2026-08-26",
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: mmToPt(26),
    medium: "PRINT",
    dpi: 300,
  });
  assert.ok((largo.moduleSizeMm ?? 0) < (corto.moduleSizeMm ?? 0));
});

test("un contenido que no entra en ningun QR es invalido", () => {
  const r = evaluateQrLegibility({
    payload: "x".repeat(5000),
    errorCorrection: "H",
    quietZoneModules: 4,
    sidePt: mmToPt(26),
    medium: "PRINT",
    dpi: 300,
  });
  assert.equal(r.level, "INVALID");
});

test("un contenido vacio es invalido", () => {
  const r = evaluateQrLegibility({
    payload: "",
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: mmToPt(26),
    medium: "PRINT",
    dpi: 300,
  });
  assert.equal(r.level, "INVALID");
});

test("en pantalla la medida es en pixeles, no en milimetros", () => {
  const r = evaluateQrLegibility({
    payload: TOKEN_CORTO,
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: 200,
    medium: "SCREEN",
    dpi: 96,
  });
  assert.equal(r.moduleSizeMm, undefined);
  assert.ok(r.moduleSizePx && r.moduleSizePx > 2);
});
