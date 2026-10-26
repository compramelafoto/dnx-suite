import assert from "node:assert/strict";
import { test } from "node:test";
import { FLASH_SYNC_SECONDS, correctAperture, flashEnergy, flashIntensityForShutter } from "./flash";

test("flash: número guía 40 → f/10 a 4 m con ISO 100 a plena potencia; cada paso de potencia es medio diafragma", () => {
  assert.ok(Math.abs(correctAperture(4, 100, 0) - 10) < 1e-9);
  assert.ok(Math.abs(correctAperture(4, 400, 0) - 20) < 1e-9);
  assert.ok(Math.abs(correctAperture(4, 100, 2) - 5) < 1e-9);
});

test("flash: hasta la sincronización la luz no depende del tiempo de exposición", () => {
  const e = flashEnergy(0);
  const total = (t: number) => flashIntensityForShutter(e, t) * t;
  assert.ok(Math.abs(total(1 / 30) - total(1 / 250)) < 1e-6);
  assert.ok(Math.abs(total(2) - total(FLASH_SYNC_SECONDS)) < 1e-6);
  // Más corto que la sincronización, la cortina tapa parte del destello.
  assert.ok(total(1 / 1000) < total(1 / 250) / 3.9);
});
