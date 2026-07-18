/**
 * Autocheck de validación de sedes (sin BD / sin Next).
 */
import assert from "node:assert/strict";
import { emptyVenueFormInput } from "./types";
import { validateVenueFormInput } from "./validation";

const base = emptyVenueFormInput("edition-1");

assert.equal(
  validateVenueFormInput({ ...base, name: "", city: "", editionId: "" }).ok,
  false,
  "required fields",
);

const valid = validateVenueFormInput({
  ...base,
  name: "Sede Centro",
  slug: "centro",
  city: "Córdoba",
  capacity: "50",
  contactEmail: "sede@clickaton.test",
});
assert.equal(valid.ok, true, "valid venue");

const badEmail = validateVenueFormInput({
  ...base,
  name: "Sede",
  slug: "sede",
  city: "Córdoba",
  contactEmail: "not-an-email",
});
assert.equal(badEmail.ok, false, "bad email");

const badRange = validateVenueFormInput({
  ...base,
  name: "Sede",
  slug: "sede",
  city: "Córdoba",
  startsAt: "2026-05-10T10:00",
  endsAt: "2026-05-01T10:00",
});
assert.equal(badRange.ok, false, "bad date range");

console.log("clickaton venues validation.selfcheck: ok");
