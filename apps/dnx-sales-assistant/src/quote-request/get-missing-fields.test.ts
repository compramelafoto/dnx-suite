import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMissingQuoteFields } from "./get-missing-fields.js";
import { selectNextQuoteQuestion, QUOTE_READY_MESSAGE } from "./select-next-question.js";

describe("getMissingQuoteFields + selectNextQuoteQuestion", () => {
  it("draft vacío → faltan cuatro campos", () => {
    assert.deepEqual(getMissingQuoteFields({}), [
      "SERVICE_TYPE",
      "EVENT_DATE",
      "CITY",
      "DURATION_HOURS",
    ]);
  });

  it("solo servicio → pregunta fecha", () => {
    const missing = getMissingQuoteFields({ serviceType: "WEDDING" });
    assert.deepEqual(missing, ["EVENT_DATE", "CITY", "DURATION_HOURS"]);
    assert.equal(
      selectNextQuoteQuestion(missing),
      "¿Para qué fecha necesitás el servicio?",
    );
  });

  it("servicio + ciudad → pregunta fecha", () => {
    const missing = getMissingQuoteFields({
      serviceType: "WEDDING",
      city: "Córdoba",
    });
    assert.deepEqual(missing, ["EVENT_DATE", "DURATION_HOURS"]);
    assert.equal(
      selectNextQuoteQuestion(missing),
      "¿Para qué fecha necesitás el servicio?",
    );
  });

  it("servicio + fecha + ciudad → pregunta duración", () => {
    const missing = getMissingQuoteFields({
      serviceType: "WEDDING",
      eventDate: "2026-09-20",
      city: "Córdoba",
    });
    assert.deepEqual(missing, ["DURATION_HOURS"]);
    assert.equal(
      selectNextQuoteQuestion(missing),
      "¿Cuántas horas de cobertura necesitás aproximadamente?",
    );
  });

  it("draft completo → READY message", () => {
    const missing = getMissingQuoteFields({
      serviceType: "WEDDING",
      eventDate: "2026-09-20",
      city: "Córdoba",
      durationHours: 8,
    });
    assert.deepEqual(missing, []);
    assert.equal(selectNextQuoteQuestion(missing), QUOTE_READY_MESSAGE);
  });

  it("orden estable y no repite campos presentes", () => {
    const missing = getMissingQuoteFields({
      eventDate: "2026-09-20",
      durationHours: 4,
    });
    assert.deepEqual(missing, ["SERVICE_TYPE", "CITY"]);
    assert.equal(
      selectNextQuoteQuestion(missing),
      "¿Qué tipo de evento o sesión fotográfica necesitás?",
    );
  });
});
