import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRegistrationDetailHeading } from "./registration-detail-heading";

describe("buildRegistrationDetailHeading", () => {
  it("prefers participant name", () => {
    assert.equal(
      buildRegistrationDetailHeading({
        firstName: "Lucía",
        lastName: "Fernández",
        editionName: "Clickatón Rosario",
      }),
      "Inscripción de Lucía Fernández",
    );
  });

  it("supports partial first name only", () => {
    assert.equal(
      buildRegistrationDetailHeading({
        firstName: "Ana",
        lastName: "  ",
        editionName: "Clickatón Rosario",
      }),
      "Inscripción de Ana",
    );
  });

  it("falls back to edition name", () => {
    assert.equal(
      buildRegistrationDetailHeading({
        firstName: "  ",
        lastName: null,
        editionName: "Clickatón Rosario",
      }),
      "Inscripción a Clickatón Rosario",
    );
  });

  it("uses neutral title when nothing available", () => {
    assert.equal(
      buildRegistrationDetailHeading({
        firstName: "",
        lastName: undefined,
        editionName: null,
      }),
      "Detalle de la inscripción",
    );
  });

  it("never returns empty, ids, or dashes alone", () => {
    const h = buildRegistrationDetailHeading({});
    assert.ok(h.trim().length > 0);
    assert.equal(h.includes("undefined"), false);
    assert.equal(h.includes("null"), false);
    assert.notEqual(h.trim(), "-");
    assert.notEqual(h.trim(), "—");
  });
});
