/**
 * Selfcheck elegibilidad Santa Fe — sin DB / sin red.
 * pnpm --filter fotorank run test:eligibility:selfcheck
 */
import assert from "node:assert/strict";
import {
  assertOpenParticipation,
  categoryRequiresArgra,
  evaluateCaptureWindowEligibility,
  evaluateSantaFeCategoryDeviceEligibility,
  evaluateTerritoryEligibility,
  normalizeArgraMembershipNumber,
  redactArgraForLog,
  SANTA_FE_CATEGORY_SLUGS,
  validateArgraMembershipNumber,
} from "./index";

// Participación abierta
const open = assertOpenParticipation();
assert.equal(open.residencyRequired, false);
assert.ok(open.publicMessage.toLowerCase().includes("abierta"));

// ARGRA
assert.equal(categoryRequiresArgra(SANTA_FE_CATEGORY_SLUGS.reporter), true);
assert.equal(categoryRequiresArgra(SANTA_FE_CATEGORY_SLUGS.amateur), false);
assert.equal(validateArgraMembershipNumber("").decision, "NOT_ELIGIBLE");
assert.equal(validateArgraMembershipNumber("   ").decision, "NOT_ELIGIBLE");
assert.equal(validateArgraMembershipNumber("AB 123").decision, "ELIGIBLE");
assert.equal(normalizeArgraMembershipNumber("  AB   123  "), "AB 123");
assert.ok(redactArgraForLog("ABCDE123")?.includes("…"));
assert.ok(!String(redactArgraForLog("ABCDE123")).includes("ABCDE123"));

// Profesional
assert.equal(
  evaluateSantaFeCategoryDeviceEligibility({
    categorySlug: SANTA_FE_CATEGORY_SLUGS.professional,
    declaredDeviceKind: "DSLR",
    exifMake: "Canon",
    exifModel: "EOS R6",
    software: null,
  }).decision,
  "ELIGIBLE",
);
assert.equal(
  evaluateSantaFeCategoryDeviceEligibility({
    categorySlug: SANTA_FE_CATEGORY_SLUGS.professional,
    declaredDeviceKind: "MIRRORLESS",
    exifMake: "Sony",
    exifModel: "A7 IV",
    software: null,
  }).decision,
  "ELIGIBLE",
);
assert.equal(
  evaluateSantaFeCategoryDeviceEligibility({
    categorySlug: SANTA_FE_CATEGORY_SLUGS.professional,
    declaredDeviceKind: "SMARTPHONE",
    exifMake: "Apple",
    exifModel: "iPhone 15",
    software: null,
  }).reasonCode,
  "PROFESSIONAL_PHONE_NOT_ALLOWED",
);
assert.equal(
  evaluateSantaFeCategoryDeviceEligibility({
    categorySlug: SANTA_FE_CATEGORY_SLUGS.professional,
    declaredDeviceKind: "SMARTPHONE",
    exifMake: "Apple",
    exifModel: "iPhone 15",
    software: null,
  }).decision,
  "MANUAL_REVIEW_REQUIRED",
);
assert.equal(
  evaluateSantaFeCategoryDeviceEligibility({
    categorySlug: SANTA_FE_CATEGORY_SLUGS.professional,
    declaredDeviceKind: "DRONE",
    exifMake: "DJI",
    exifModel: "Mini 3",
    software: null,
  }).decision,
  "NOT_ELIGIBLE",
);
assert.equal(
  evaluateSantaFeCategoryDeviceEligibility({
    categorySlug: SANTA_FE_CATEGORY_SLUGS.professional,
    declaredDeviceKind: "UNKNOWN",
    exifMake: null,
    exifModel: null,
    software: null,
  }).decision,
  "MANUAL_REVIEW_REQUIRED",
);

// Amateur
assert.equal(
  evaluateSantaFeCategoryDeviceEligibility({
    categorySlug: SANTA_FE_CATEGORY_SLUGS.amateur,
    declaredDeviceKind: "SMARTPHONE",
    exifMake: "Apple",
    exifModel: "iPhone",
    software: null,
  }).decision,
  "ELIGIBLE",
);
assert.equal(
  evaluateSantaFeCategoryDeviceEligibility({
    categorySlug: SANTA_FE_CATEGORY_SLUGS.amateur,
    declaredDeviceKind: "MIRRORLESS",
    exifMake: "Sony",
    exifModel: "A7",
    software: null,
  }).decision,
  "ELIGIBLE",
);
assert.equal(
  evaluateSantaFeCategoryDeviceEligibility({
    categorySlug: SANTA_FE_CATEGORY_SLUGS.amateur,
    declaredDeviceKind: "COMPACT_CAMERA",
    exifMake: "Ricoh",
    exifModel: "GR III",
    software: null,
  }).decision,
  "ELIGIBLE",
);
assert.equal(
  evaluateSantaFeCategoryDeviceEligibility({
    categorySlug: SANTA_FE_CATEGORY_SLUGS.amateur,
    declaredDeviceKind: "DRONE",
    exifMake: "DJI",
    exifModel: "Mavic",
    software: null,
  }).decision,
  "NOT_ELIGIBLE",
);
// Cámara profesional no infiere categoría profesional
assert.equal(
  evaluateSantaFeCategoryDeviceEligibility({
    categorySlug: SANTA_FE_CATEGORY_SLUGS.amateur,
    declaredDeviceKind: "DSLR",
    exifMake: "Canon",
    exifModel: "EOS-1D X",
    software: null,
  }).decision,
  "ELIGIBLE",
);

// Aérea
assert.equal(
  evaluateSantaFeCategoryDeviceEligibility({
    categorySlug: SANTA_FE_CATEGORY_SLUGS.aerial,
    declaredDeviceKind: "DRONE",
    exifMake: "DJI",
    exifModel: "Air 2S",
    software: null,
  }).decision,
  "ELIGIBLE",
);
assert.equal(
  evaluateSantaFeCategoryDeviceEligibility({
    categorySlug: SANTA_FE_CATEGORY_SLUGS.aerial,
    declaredDeviceKind: "DSLR",
    exifMake: "Nikon",
    exifModel: "D850",
    software: null,
  }).reasonCode,
  "AERIAL_DRONE_REQUIRED",
);

// Territorio
assert.equal(
  evaluateTerritoryEligibility({
    territoryConfirmedSantaFe: true,
    captureLocality: "Rosario",
  }).territoryStatus,
  "TERRITORY_CONFIRMED_BY_DECLARATION",
);
assert.equal(
  evaluateTerritoryEligibility({
    territoryConfirmedSantaFe: true,
    captureLocality: "Rosario",
    gpsLatitude: -32.94,
    gpsLongitude: -60.65,
  }).territoryStatus,
  "TERRITORY_SUPPORTED_BY_GPS",
);
assert.equal(
  evaluateTerritoryEligibility({
    territoryConfirmedSantaFe: true,
    captureLocality: "Rosario",
    gpsLatitude: -34.6,
    gpsLongitude: -58.4,
  }).territoryStatus,
  "TERRITORY_REVIEW_REQUIRED",
);
assert.equal(
  evaluateTerritoryEligibility({
    territoryConfirmedSantaFe: false,
    captureLocality: "Rosario",
  }).decision,
  "NOT_ELIGIBLE",
);
assert.equal(
  evaluateTerritoryEligibility({
    territoryConfirmedSantaFe: true,
    captureLocality: "",
  }).decision,
  "NOT_ELIGIBLE",
);
// GPS ausente no rechaza
assert.equal(
  evaluateTerritoryEligibility({
    territoryConfirmedSantaFe: true,
    captureLocality: "Rafaela",
    gpsLatitude: null,
    gpsLongitude: null,
  }).decision,
  "DECLARED_VALID",
);

// Período (ventana sintética)
const start = new Date("2026-08-01T03:00:00.000Z");
const endEx = new Date("2026-10-01T03:00:00.000Z");
assert.equal(
  evaluateCaptureWindowEligibility({
    captureDate: new Date("2026-09-15T15:00:00.000Z"),
    captureWindowStartsAt: start,
    captureWindowEndsExclusiveAt: endEx,
  }).decision,
  "WITHIN_CAPTURE_WINDOW",
);
assert.equal(
  evaluateCaptureWindowEligibility({
    captureDate: new Date("2026-07-01T15:00:00.000Z"),
    captureWindowStartsAt: start,
    captureWindowEndsExclusiveAt: endEx,
  }).decision,
  "OUTSIDE_CAPTURE_WINDOW_REVIEW",
);
assert.equal(
  evaluateCaptureWindowEligibility({
    captureDate: null,
    captureWindowStartsAt: start,
    captureWindowEndsExclusiveAt: endEx,
  }).decision,
  "DATE_MISSING_REVIEW",
);
// límite inclusivo: último ms antes del exclusive
assert.equal(
  evaluateCaptureWindowEligibility({
    captureDate: new Date(endEx.getTime() - 1),
    captureWindowStartsAt: start,
    captureWindowEndsExclusiveAt: endEx,
  }).decision,
  "WITHIN_CAPTURE_WINDOW",
);
assert.equal(
  evaluateCaptureWindowEligibility({
    captureDate: endEx,
    captureWindowStartsAt: start,
    captureWindowEndsExclusiveAt: endEx,
  }).decision,
  "OUTSIDE_CAPTURE_WINDOW_REVIEW",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      checks: [
        "open_participation",
        "argra",
        "professional_amateur_aerial_devices",
        "territory",
        "capture_window",
      ],
    },
    null,
    2,
  ),
);
console.log("eligibility.selfcheck.ts OK");
