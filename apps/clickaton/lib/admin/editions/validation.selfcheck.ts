/**
 * Autocheck de validación de ediciones (sin BD / sin Next).
 */
import assert from "node:assert/strict";
import { emptyEditionFormInput } from "./types";
import { validateEditionFormInput } from "./validation";

const base = emptyEditionFormInput();

assert.equal(
  validateEditionFormInput({ ...base, name: "", slug: "" }).ok,
  false,
  "name required",
);

const valid = validateEditionFormInput({
  ...base,
  name: "Clickatón Córdoba 2026",
  slug: "clickaton-cordoba-2026",
  startAt: "2026-05-01T09:00",
  endAt: "2026-05-01T18:00",
  registrationOpenAt: "2026-04-01T09:00",
  registrationCloseAt: "2026-04-30T23:59",
  defaultCapacity: "120",
  coverImageUrl: "https://cdn.example.com/cover.jpg",
  fotorankContestId: "clxyz123",
});
assert.equal(valid.ok, true, "valid edition");

const badSlug = validateEditionFormInput({
  ...base,
  name: "Test",
  slug: "!!!",
});
assert.equal(badSlug.ok, false, "invalid slug");

const badDates = validateEditionFormInput({
  ...base,
  name: "Test",
  slug: "test",
  startAt: "2026-05-10T10:00",
  endAt: "2026-05-01T10:00",
});
assert.equal(badDates.ok, false, "end before start");

const badCapacity = validateEditionFormInput({
  ...base,
  name: "Test",
  slug: "test",
  defaultCapacity: "-1",
});
assert.equal(badCapacity.ok, false, "negative capacity");

const badUrl = validateEditionFormInput({
  ...base,
  name: "Test",
  slug: "test",
  coverImageUrl: "ftp://bad.example",
});
assert.equal(badUrl.ok, false, "bad cover url");

console.log("clickaton editions validation.selfcheck: ok");
