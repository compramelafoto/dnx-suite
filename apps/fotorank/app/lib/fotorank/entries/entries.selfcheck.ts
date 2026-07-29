/**
 * Self-check dominio obras P0-06 (sin DB).
 * pnpm --filter @repo/db exec tsx ../../apps/fotorank/app/lib/fotorank/entries/entries.selfcheck.ts
 */
import assert from "node:assert/strict";
import { sha256Buffer } from "./hash";
import { assessDeviceCompatibility, extractEntryExif } from "./exif";
import { buildChecklist, summarizeChecklist } from "./checklist";
import { SANTA_FE_EN_FOCO_UPLOAD_POLICY_DRAFT } from "./upload-policy";
import {
  buildVersionedEntryStorageKey,
  storageKeyContainsPiiLeak,
} from "../storage/private-local-storage";
import { readImageDimensions } from "./derivatives";

// 1-2 hash estable
{
  const a = sha256Buffer(Buffer.from("hello-fotorank"));
  const b = sha256Buffer(Buffer.from("hello-fotorank"));
  assert.equal(a, b);
  assert.equal(a.length, 64);
  assert.notEqual(a, sha256Buffer(Buffer.from("hello-fotorank!")));
}

// 3 storage key sin PII
{
  const key = buildVersionedEntryStorageKey({
    contestId: "c1",
    entryId: "e1",
    versionNumber: 2,
    kind: "original",
    assetId: "a1",
  });
  assert.equal(key, "fotorank/contests/c1/entries/e1/versions/2/original/a1");
  assert.equal(storageKeyContainsPiiLeak(key), false);
  assert.equal(storageKeyContainsPiiLeak("fotorank/user@mail.com/x"), true);
}

// 4 EXIF vacío / buffer no imagen
{
  const empty = await extractEntryExif(Buffer.from("not-an-image"));
  assert.ok(empty.metadataStatus === "NOT_AVAILABLE" || empty.metadataStatus === "FAILED");
}

// 5 device heuristics
assert.equal(
  assessDeviceCompatibility({ categorySlug: "celular", make: "Apple", model: "iPhone 15", software: null }),
  "compatible",
);
assert.equal(
  assessDeviceCompatibility({ categorySlug: "camara", make: "Canon", model: "EOS R6", software: null }),
  "compatible",
);
assert.equal(
  assessDeviceCompatibility({ categorySlug: "celular", make: "Canon", model: "EOS R6", software: null }),
  "inconsistent",
);
assert.equal(
  assessDeviceCompatibility({ categorySlug: "general", make: null, model: null, software: null }),
  "not_verifiable",
);

// 6 checklist PASS path
{
  const items = buildChecklist({
    policy: SANTA_FE_EN_FOCO_UPLOAD_POLICY_DRAFT,
    mimeType: "image/jpeg",
    extension: "jpg",
    fileSizeBytes: 1_000_000,
    width: 2400,
    height: 1600,
    decodable: true,
    registrationConfirmed: true,
    categoryMatches: true,
    userMatches: true,
    contestActive: true,
    categoryActive: true,
    withinUploadWindow: true,
    maxEntriesOk: true,
    exif: {
      cameraMake: "Canon",
      cameraModel: "R6",
      lensModel: null,
      captureDate: new Date("2026-08-10T12:00:00Z"),
      digitizedDate: null,
      software: null,
      iso: "200",
      aperture: "f/2.8",
      shutterSpeed: "1/250",
      focalLength: "35",
      gpsLatitude: null,
      gpsLongitude: null,
      gpsAltitude: null,
      orientation: "1",
      colorSpace: null,
      metadataStatus: "EXTRACTED",
      rawMetadataJson: {},
    },
    duplicate: { scope: "NONE", matchingAssetId: null, matchingEntryId: null },
    deviceCompatibility: "compatible",
    storagePrivate: true,
    storageKeyValid: true,
  });
  const summary = summarizeChecklist(items);
  assert.equal(summary.failures, 0);
  assert.ok(summary.status === "APPROVED" || summary.status === "APPROVED_WITH_WARNINGS");
}

// 7 EXIF missing → WARNING/REQUIRES_REVIEW, never FAIL on META_EXIF alone
{
  const items = buildChecklist({
    policy: { ...SANTA_FE_EN_FOCO_UPLOAD_POLICY_DRAFT, requireExif: false },
    mimeType: "image/jpeg",
    extension: "jpg",
    fileSizeBytes: 1_000_000,
    width: 2400,
    height: 1600,
    decodable: true,
    registrationConfirmed: true,
    categoryMatches: true,
    userMatches: true,
    contestActive: true,
    categoryActive: true,
    withinUploadWindow: true,
    maxEntriesOk: true,
    exif: {
      cameraMake: null,
      cameraModel: null,
      lensModel: null,
      captureDate: null,
      digitizedDate: null,
      software: null,
      iso: null,
      aperture: null,
      shutterSpeed: null,
      focalLength: null,
      gpsLatitude: null,
      gpsLongitude: null,
      gpsAltitude: null,
      orientation: null,
      colorSpace: null,
      metadataStatus: "NOT_AVAILABLE",
      rawMetadataJson: null,
    },
    duplicate: { scope: "NONE", matchingAssetId: null, matchingEntryId: null },
    deviceCompatibility: "not_verifiable",
    storagePrivate: true,
    storageKeyValid: true,
  });
  const meta = items.find((i) => i.checkCode === "META_EXIF");
  assert.ok(meta);
  assert.notEqual(meta.status, "FAIL");
  const summary = summarizeChecklist(items);
  assert.notEqual(summary.status, "TECHNICALLY_REJECTED");
}

// 8 duplicate contest → REQUIRES_REVIEW
{
  const items = buildChecklist({
    policy: SANTA_FE_EN_FOCO_UPLOAD_POLICY_DRAFT,
    mimeType: "image/jpeg",
    extension: "jpg",
    fileSizeBytes: 1_000_000,
    width: 2400,
    height: 1600,
    decodable: true,
    registrationConfirmed: true,
    categoryMatches: true,
    userMatches: true,
    contestActive: true,
    categoryActive: true,
    withinUploadWindow: true,
    maxEntriesOk: true,
    exif: {
      cameraMake: null,
      cameraModel: null,
      lensModel: null,
      captureDate: null,
      digitizedDate: null,
      software: null,
      iso: null,
      aperture: null,
      shutterSpeed: null,
      focalLength: null,
      gpsLatitude: null,
      gpsLongitude: null,
      gpsAltitude: null,
      orientation: null,
      colorSpace: null,
      metadataStatus: "NOT_AVAILABLE",
      rawMetadataJson: null,
    },
    duplicate: { scope: "SAME_CONTEST", matchingAssetId: "x", matchingEntryId: "y" },
    deviceCompatibility: "not_verifiable",
    storagePrivate: true,
    storageKeyValid: true,
  });
  const summary = summarizeChecklist(items);
  assert.equal(summary.status, "REQUIRES_REVIEW");
}

// 9 FAIL mime
{
  const items = buildChecklist({
    policy: SANTA_FE_EN_FOCO_UPLOAD_POLICY_DRAFT,
    mimeType: "image/png",
    extension: "png",
    fileSizeBytes: 1000,
    width: 2400,
    height: 1600,
    decodable: true,
    registrationConfirmed: true,
    categoryMatches: true,
    userMatches: true,
    contestActive: true,
    categoryActive: true,
    withinUploadWindow: true,
    maxEntriesOk: true,
    exif: {
      cameraMake: null,
      cameraModel: null,
      lensModel: null,
      captureDate: null,
      digitizedDate: null,
      software: null,
      iso: null,
      aperture: null,
      shutterSpeed: null,
      focalLength: null,
      gpsLatitude: null,
      gpsLongitude: null,
      gpsAltitude: null,
      orientation: null,
      colorSpace: null,
      metadataStatus: "NOT_AVAILABLE",
      rawMetadataJson: null,
    },
    duplicate: { scope: "NONE", matchingAssetId: null, matchingEntryId: null },
    deviceCompatibility: "not_verifiable",
    storagePrivate: true,
    storageKeyValid: true,
  });
  assert.equal(summarizeChecklist(items).status, "TECHNICALLY_REJECTED");
}

// 10 dimensions via sharp on tiny invalid
{
  const dims = await readImageDimensions(Buffer.from("nope"));
  assert.equal(dims.decodable, false);
}

console.log("entries.selfcheck.ts OK");
