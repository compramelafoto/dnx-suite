import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FULL_DAY_HOURS, HALF_DAY_HOURS } from "./models.js";
import { extractDurationHours } from "./extract-duration.js";

describe("extractDurationHours", () => {
  it("parsea horas numéricas y en palabras", () => {
    assert.equal(extractDurationHours("por 4 horas").durationHours, 4);
    assert.equal(extractDurationHours("4 hs").durationHours, 4);
    assert.equal(extractDurationHours("cuatro horas").durationHours, 4);
  });

  it("media jornada y jornada completa", () => {
    assert.equal(extractDurationHours("media jornada").durationHours, HALF_DAY_HOURS);
    assert.equal(extractDurationHours("jornada completa").durationHours, FULL_DAY_HOURS);
  });

  it("no interpreta hora del evento como duración", () => {
    assert.equal(extractDurationHours("arranca a las 20 horas").durationHours, undefined);
  });

  it("duración absurda genera warning", () => {
    const result = extractDurationHours("por 48 horas");
    assert.equal(result.durationHours, undefined);
    assert.ok(result.warnings.includes("DURATION_TOO_LONG"));
  });
});
