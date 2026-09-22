import assert from "node:assert/strict";
import { test } from "node:test";
import { type EligibilityFacts, resolveEligibility } from "./eligibility";

const sinNada: EligibilityFacts = {
  confirmedRegistration: null,
  venue: null,
  juror: null,
  emailVerified: true,
  matchedByEmailOnly: false,
};

const inscripcion = {
  id: "reg1",
  firstName: "Ana",
  lastName: "Pérez",
  profilePhotoAssetId: "asset1",
  instagramUrl: "https://instagram.com/ana",
};

test("un participante confirmado puede testimoniar", () => {
  const r = resolveEligibility({ ...sinNada, confirmedRegistration: inscripcion });
  assert.equal(r.eligible, true);
  if (!r.eligible) return;
  assert.equal(r.role, "PARTICIPANT");
  assert.equal(r.authorName, "Ana Pérez");
  assert.equal(r.authorPhotoAssetId, "asset1");
  assert.equal(r.suggestedLinkUrl, "https://instagram.com/ana");
  assert.equal(r.registrationId, "reg1");
  assert.equal(r.venueId, null);
});

test("el contacto de una sede puede testimoniar", () => {
  const r = resolveEligibility({ ...sinNada, venue: { id: "v1", name: "Sede Córdoba" } });
  assert.equal(r.eligible, true);
  if (!r.eligible) return;
  assert.equal(r.role, "VENUE");
  assert.equal(r.authorName, "Sede Córdoba");
  assert.equal(r.venueId, "v1");
  assert.equal(r.registrationId, null);
});

test("un jurado puede testimoniar", () => {
  const r = resolveEligibility({
    ...sinNada,
    juror: { name: "Jurado Uno", photoAssetId: null },
  });
  assert.equal(r.eligible, true);
  if (!r.eligible) return;
  assert.equal(r.role, "JUROR");
  assert.equal(r.authorName, "Jurado Uno");
});

test("el participante gana sobre los otros roles", () => {
  const r = resolveEligibility({
    ...sinNada,
    confirmedRegistration: inscripcion,
    venue: { id: "v1", name: "Sede Córdoba" },
    juror: { name: "Jurado Uno", photoAssetId: null },
  });
  assert.equal(r.eligible, true);
  if (!r.eligible) return;
  assert.equal(r.role, "PARTICIPANT");
});

test("sin ningún rol no puede responder", () => {
  const r = resolveEligibility(sinNada);
  assert.equal(r.eligible, false);
  if (r.eligible) return;
  assert.equal(r.reason, "NO_ROLE");
});

test("si el vínculo vino sólo por correo, el correo tiene que estar verificado", () => {
  const r = resolveEligibility({
    ...sinNada,
    emailVerified: false,
    matchedByEmailOnly: true,
    confirmedRegistration: inscripcion,
  });
  assert.equal(r.eligible, false);
  if (r.eligible) return;
  assert.equal(r.reason, "EMAIL_NOT_VERIFIED");
});

test("con el vínculo por usuario, el correo sin verificar no molesta", () => {
  const r = resolveEligibility({
    ...sinNada,
    emailVerified: false,
    matchedByEmailOnly: false,
    confirmedRegistration: inscripcion,
  });
  assert.equal(r.eligible, true);
});

test("un apellido vacío no deja un nombre con espacio colgando", () => {
  const r = resolveEligibility({
    ...sinNada,
    confirmedRegistration: { ...inscripcion, lastName: "  " },
  });
  assert.equal(r.eligible, true);
  if (!r.eligible) return;
  assert.equal(r.authorName, "Ana");
});
