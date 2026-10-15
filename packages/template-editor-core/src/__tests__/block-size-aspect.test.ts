import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeAspect,
  findAspectPreset,
  fitBoxToAspect,
  formatBlockSize,
  getBlockAspectLock,
} from "../block-size-aspect";
import { normalizeBlockConfig } from "../render-core";

test("reconoce los formatos comunes aunque los píxeles redondeen", () => {
  assert.equal(findAspectPreset(1080, 1080)?.label, "1:1");
  assert.equal(findAspectPreset(1080, 1350)?.label, "4:5");
  assert.equal(findAspectPreset(1080, 1920)?.label, "9:16");
  assert.equal(findAspectPreset(6000, 4000)?.label, "3:2");
  assert.equal(findAspectPreset(1001, 750)?.label, "4:3");
});

test("un recuadro sin formato conocido muestra su relación", () => {
  assert.equal(findAspectPreset(142, 100), null);
  assert.equal(describeAspect(142, 100), "1,42:1");
  assert.equal(describeAspect(100, 142), "1:1,42");
});

test("convierte el tamaño a mm con el dpi del lienzo", () => {
  // 300 dpi: 1004 px ≈ 85 mm; 650 px ≈ 55 mm (tarjeta personal).
  assert.equal(formatBlockSize(1004, 650, "mm", 300), "85 × 55 mm");
  assert.equal(formatBlockSize(1004, 650, "cm", 300), "8,5 × 5,5 cm");
  assert.equal(formatBlockSize(600, 600, "mm", 600), "25,4 × 25,4 mm");
});

test("aplicar un formato conserva el centro y el ancho", () => {
  const out = fitBoxToAspect({ x: 100, y: 100, width: 400, height: 400 }, 4 / 5, { width: 2000, height: 2000 });
  assert.equal(out.width, 400);
  assert.equal(out.height, 500);
  assert.equal(out.x + out.width / 2, 300);
  assert.equal(out.y + out.height / 2, 300);
});

test("si el formato no entra en el lienzo, achica los dos lados", () => {
  const out = fitBoxToAspect({ x: 0, y: 0, width: 1000, height: 300 }, 9 / 16, { width: 1000, height: 1000 });
  assert.ok(out.height <= 1000 + 1e-9);
  assert.ok(Math.abs(out.width / out.height - 9 / 16) < 1e-9);
});

test("la proporción fijada sobrevive a la normalización de cualquier tipo", () => {
  for (const type of ["IMAGE", "SHAPE", "QR", "TEXT", "PHOTO"] as const) {
    const cfg = normalizeBlockConfig(type, { aspectLock: 1.5 });
    assert.equal(getBlockAspectLock(cfg), 1.5, type);
  }
  assert.equal(getBlockAspectLock(normalizeBlockConfig("IMAGE", { aspectLock: "4:3" })), null);
  assert.equal("aspectLock" in normalizeBlockConfig("IMAGE", {}), false);
});
