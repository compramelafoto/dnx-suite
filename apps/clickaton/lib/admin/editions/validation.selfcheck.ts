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
  name: "Clickatón Argentina 2026",
  slug: "clickaton-argentina-2026",
  startAt: "2026-09-19T09:00",
  endAt: "2026-09-19T20:00",
  registrationOpenAt: "2026-08-01T09:00",
  registrationCloseAt: "2026-09-18T23:59",
  defaultCapacity: "120",
  country: "AR",
  currency: "ARS",
  location: "Argentina",
  coverImageUrl: "https://cdn.example.com/cover.jpg",
  coverImageVerticalUrl: "https://cdn.example.com/cover-v.jpg",
  fotorankContestId: "clxyz123",
});
assert.equal(valid.ok, true, "valid edition");

const blockedGate = validateEditionFormInput({
  ...base,
  name: "Clickatón Argentina 2026",
  slug: "clickaton-argentina-2026",
  status: "DRAFT",
  isPublished: false,
  registrationEnabled: true,
});
assert.equal(blockedGate.ok, false, "registrationEnabled blocked in DRAFT");

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
