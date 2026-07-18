import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeQuoteRequestDraft } from "./merge-quote-draft.js";

describe("mergeQuoteRequestDraft", () => {
  it("agrega campos y conserva previos", () => {
    const current = { serviceType: "WEDDING" as const, eventDate: "2026-09-20" };
    const result = mergeQuoteRequestDraft(current, { city: "Córdoba" });
    assert.deepEqual(result.draft, {
      serviceType: "WEDDING",
      eventDate: "2026-09-20",
      city: "Córdoba",
    });
  });

  it("no sobrescribe con undefined y no muta el original", () => {
    const current = { serviceType: "WEDDING" as const, city: "Córdoba" };
    const freeze = { ...current };
    const result = mergeQuoteRequestDraft(current, { city: undefined, eventDate: "2026-09-21" });
    assert.equal(result.draft.city, "Córdoba");
    assert.equal(result.draft.eventDate, "2026-09-21");
    assert.deepEqual(current, freeze);
  });

  it("reemplaza fecha, ciudad y duración explícitas", () => {
    const result = mergeQuoteRequestDraft(
      {
        serviceType: "WEDDING",
        eventDate: "2026-09-20",
        city: "Córdoba",
        durationHours: 8,
      },
      {
        eventDate: "2026-09-21",
        city: "Villa Carlos Paz",
        durationHours: 6,
      },
    );
    assert.equal(result.draft.eventDate, "2026-09-21");
    assert.equal(result.draft.city, "Villa Carlos Paz");
    assert.equal(result.draft.durationHours, 6);
  });

  it("draft vacío + servicio", () => {
    const result = mergeQuoteRequestDraft(undefined, { serviceType: "WEDDING" });
    assert.deepEqual(result.draft, { serviceType: "WEDDING" });
  });
});
