/**
 * Selfcheck P0-07 — anonimización, orden, placeholders, R2 config (sin DB).
 * pnpm --filter fotorank run test:jury:selfcheck
 */
import assert from "node:assert/strict";
import {
  assertNoForbiddenJuryFields,
  JURY_FORBIDDEN_FIELD_NAMES,
} from "./serialize-entry-for-juror";
import { buildJuryTechnicalSummary } from "./jury-technical-summary";
import { sortEntriesForJuror, stableAnonymousSortKey } from "./jury-order";
import {
  contentHasCriticalPlaceholder,
  gatePlaceholderContent,
  isFotorankProductionEnvironment,
} from "../registration/production-gate";
import { r2PrivateStorageConfigSelfcheck } from "../storage/r2-private-storage";
import { resolvePrivateStorageProviderName } from "../storage/provider";
import { isEvaluableFotorankContestEntry } from "../fotorankContestEntryDomain";

// 1-2 serialización / exclusión
{
  const bad = {
    anonymousCode: "SFE-E-000001",
    email: "x@y.com",
    storageKey: "secret",
    nested: { gpsLatitude: 1, sha256: "abc" },
  };
  const leaks = assertNoForbiddenJuryFields(bad);
  assert.ok(leaks.some((p) => p.includes("email")));
  assert.ok(leaks.some((p) => p.includes("storageKey")));
  assert.ok(leaks.some((p) => p.includes("gpsLatitude")));
  assert.ok(leaks.some((p) => p.includes("sha256")));
  assert.ok(JURY_FORBIDDEN_FIELD_NAMES.includes("participantUserId"));
}

{
  const clean = {
    anonymousCode: "SFE-E-000001",
    categoryName: "Celular",
    technical: { allowedChecks: [{ checkCode: "FILE_MIME", status: "PASS", title: "MIME", message: "ok", checkGroup: "FILE" }] },
  };
  assert.equal(assertNoForbiddenJuryFields(clean).length, 0);
}

// 3 checklist filtrado / GPS raw fuera
{
  const summary = buildJuryTechnicalSummary({
    technicalSummaryStatus: "APPROVED_WITH_WARNINGS",
    width: 2400,
    height: 1600,
    checks: [
      { checkCode: "FILE_MIME", checkGroup: "FILE", status: "PASS", title: "MIME", message: "ok" },
      { checkCode: "META_EXIF", checkGroup: "METADATA", status: "NOT_AVAILABLE", title: "EXIF", message: "sin exif" },
      { checkCode: "SECRET", checkGroup: "SECURITY", status: "PASS", title: "x", message: "no debe pasar" },
    ],
    metadata: { metadataStatus: "NOT_AVAILABLE", orientation: null, software: null },
    manualReviewStatus: "NONE",
    evaluationStatus: "NOT_STARTED",
  });
  assert.equal(summary.evaluationEnabled, false);
  assert.equal(summary.exifAvailable, false);
  assert.ok(!summary.allowedChecks.some((c) => c.checkCode === "SECRET"));
  assert.ok(!("gpsLatitude" in summary));
}

// 4 orden anónimo estable
{
  const a = stableAnonymousSortKey({ judgeAccountId: "j1", contestId: "c1", entryId: "e1" });
  const b = stableAnonymousSortKey({ judgeAccountId: "j1", contestId: "c1", entryId: "e1" });
  assert.equal(a, b);
  const sorted = sortEntriesForJuror(
    [{ entryId: "e2" }, { entryId: "e1" }, { entryId: "e3" }],
    "j1",
    "c1",
  );
  assert.equal(sorted.length, 3);
  const again = sortEntriesForJuror(
    [{ entryId: "e3" }, { entryId: "e2" }, { entryId: "e1" }],
    "j1",
    "c1",
  );
  assert.deepEqual(
    sorted.map((x) => x.entryId),
    again.map((x) => x.entryId),
  );
}

// 5 evaluable CONFIRMED vs draft
assert.equal(
  isEvaluableFotorankContestEntry({
    contestId: "c",
    categoryId: "k",
    imageUrl: "",
    status: "CONFIRMED",
    entryNumber: "SFE-E-1",
    withdrawnAt: null,
  }),
  true,
);
assert.equal(
  isEvaluableFotorankContestEntry({
    contestId: "c",
    categoryId: "k",
    imageUrl: "",
    status: "DRAFT",
    entryNumber: null,
    withdrawnAt: null,
  }),
  false,
);

// 6 placeholders
assert.equal(contentHasCriticalPlaceholder("BORRADOR — VALIDAR ANTES DE PRODUCCIÓN"), true);
{
  const prev = process.env.FOTORANK_APP_ENV;
  process.env.FOTORANK_APP_ENV = "production";
  assert.equal(isFotorankProductionEnvironment(), true);
  const blocked = gatePlaceholderContent("TODO reemplazar bases");
  assert.equal(blocked.allowed, false);
  process.env.FOTORANK_APP_ENV = "local";
  const warn = gatePlaceholderContent("BORRADOR");
  assert.equal(warn.allowed, true);
  assert.ok(warn.warning);
  process.env.FOTORANK_APP_ENV = prev;
}

// 7 storage provider name defaults local without creds
process.env.FOTORANK_PRIVATE_STORAGE_PROVIDER = "local";
assert.equal(resolvePrivateStorageProviderName(), "local");
const r2 = r2PrivateStorageConfigSelfcheck();
assert.equal(typeof r2.configured, "boolean");

console.log("jury.selfcheck.ts OK");
