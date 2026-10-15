import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isScheduledPublication, publishedAtFor } from "./schedule";

const now = new Date("2026-10-05T15:00:00.000Z");
const future = "2026-10-12T13:00:00.000Z";
const past = "2026-09-01T13:00:00.000Z";

describe("isScheduledPublication", () => {
  it("publicado con fecha futura está programado", () => {
    assert.equal(isScheduledPublication("PUBLISHED", future, now), true);
  });
  it("con fecha pasada o sin fecha ya está publicado", () => {
    assert.equal(isScheduledPublication("PUBLISHED", past, now), false);
    assert.equal(isScheduledPublication("PUBLISHED", "", now), false);
  });
  it("un borrador nunca está programado", () => {
    assert.equal(isScheduledPublication("DRAFT", future, now), false);
  });
});

describe("publishedAtFor", () => {
  it("programar manda la fecha elegida si es futura", () => {
    assert.equal(publishedAtFor("schedule", { status: "DRAFT", publishedAt: future }, now), future);
  });
  it("programar con fecha pasada o vacía no sirve", () => {
    assert.equal(publishedAtFor("schedule", { status: "DRAFT", publishedAt: past }, now), null);
    assert.equal(publishedAtFor("schedule", { status: "DRAFT", publishedAt: "" }, now), null);
  });
  it("publicar ahora adelanta uno programado a este momento", () => {
    assert.equal(publishedAtFor("publishNow", { status: "PUBLISHED", publishedAt: future }, now), now.toISOString());
  });
  it("publicar ahora conserva la fecha de uno ya publicado o deja que el servidor la ponga", () => {
    assert.equal(publishedAtFor("publishNow", { status: "PUBLISHED", publishedAt: past }, now), undefined);
    assert.equal(publishedAtFor("publishNow", { status: "DRAFT", publishedAt: "" }, now), undefined);
  });
  it("guardar cambios de uno programado respeta la fecha del campo; uno publicado o un borrador no la mandan", () => {
    assert.equal(publishedAtFor("save", { status: "PUBLISHED", publishedAt: future }, now), future);
    assert.equal(publishedAtFor("save", { status: "PUBLISHED", publishedAt: past }, now), undefined);
    assert.equal(publishedAtFor("save", { status: "DRAFT", publishedAt: future }, now), undefined);
  });
});
