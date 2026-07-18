import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractEventDate } from "./extract-date.js";

describe("extractEventDate", () => {
  it("normaliza formatos completos a ISO", () => {
    assert.equal(extractEventDate("el 20/09/2026").eventDate, "2026-09-20");
    assert.equal(extractEventDate("el 20-09-2026").eventDate, "2026-09-20");
    assert.equal(extractEventDate("fecha 2026-09-20").eventDate, "2026-09-20");
  });

  it("rechaza fecha inválida", () => {
    const result = extractEventDate("32/13/2026");
    assert.equal(result.eventDate, undefined);
    assert.ok(result.warnings.includes("INVALID_DATE"));
  });

  it("fecha sin año genera YEAR_MISSING", () => {
    const result = extractEventDate("el 20 de septiembre");
    assert.equal(result.eventDate, undefined);
    assert.ok(result.warnings.includes("YEAR_MISSING"));
  });

  it("no inventa fechas relativas", () => {
    const result = extractEventDate("para mañana");
    assert.equal(result.eventDate, undefined);
    assert.ok(result.warnings.includes("RELATIVE_DATE_UNSUPPORTED"));
  });

  it("acepta fecha escrita con año", () => {
    assert.equal(
      extractEventDate("el 20 de septiembre de 2026").eventDate,
      "2026-09-20",
    );
  });
});
