/**
 * Selfcheck ETAPA 08 — readiness, hash, privacy pública, anti-JudgeVote.
 */
import assert from "node:assert/strict";
import { buildResultPublicationHash } from "./publication-hash";
import {
  assertPublicResultsPayloadSafe,
  PUBLIC_RESULTS_FORBIDDEN_KEYS,
} from "./public-results-payload";
import { emptyPublicationMeta, parsePublicationMeta } from "./publication-types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function section(title: string) {
  console.log(`\n== ${title}`);
}

section("1. publication hash estable");
const base = {
  contestId: "c1",
  batchId: "b1",
  engineVersion: "clickaton-ranking-v1",
  ruleSetVersion: 1,
  entries: [
    {
      anonymousCode: "A2",
      categoryId: "cat",
      scopeKey: "cat",
      finalPosition: 2,
      aggregateScore: 8,
      awardType: "SECOND_PLACE",
      resultStatus: "RANKED",
    },
    {
      anonymousCode: "A1",
      categoryId: "cat",
      scopeKey: "cat",
      finalPosition: 1,
      aggregateScore: 9,
      awardType: "FIRST_PLACE",
      resultStatus: "WINNER",
    },
  ],
  finalists: [{ anonymousCode: "A1", categoryId: "cat", status: "AUTO_SELECTED" }],
  winners: [{ anonymousCode: "A1", categoryId: "cat", awardType: "FIRST_PLACE" }],
  awardsConfigStatus: "STAGING_TEST_CONFIGURATION",
  rubricStatus: "STAGING_TEST_CONFIGURATION",
  institutionalStatus: "APPROVED",
  legalStatus: "APPROVED",
  publicScoresMode: "HIDDEN",
};
const h1 = buildResultPublicationHash(base);
const h2 = buildResultPublicationHash({
  ...base,
  entries: [...base.entries].reverse(),
});
assert.equal(h1, h2);
const h3 = buildResultPublicationHash({
  ...base,
  entries: base.entries.map((e) =>
    e.anonymousCode === "A1" ? { ...e, aggregateScore: 9.1 } : e,
  ),
});
assert.notEqual(h1, h3);

section("2. meta parse defaults");
const meta = parsePublicationMeta(null);
assert.equal(meta.rubricConfirmation?.status, "PENDING_ORGANIZER_DECISION");
assert.equal(meta.publication?.publicScoresMode, "HIDDEN");
assert.equal(emptyPublicationMeta().schemaVersion, 1);

section("3. public payload allowlist");
assert.ok(PUBLIC_RESULTS_FORBIDDEN_KEYS.includes("aggregateScore"));
assert.ok(PUBLIC_RESULTS_FORBIDDEN_KEYS.includes("storageKey"));
const safe = {
  published: true,
  categories: [{ slug: "x", winners: [{ anonymousCode: "A1", awardType: "FIRST_PLACE" }] }],
};
assert.equal(assertPublicResultsPayloadSafe(safe).length, 0);
const unsafe = { ...safe, aggregateScore: 9 };
assert.ok(assertPublicResultsPayloadSafe(unsafe).includes("aggregateScore"));

section("4. result-service no usa FotorankJudgeVote");
const resultServicePath = join(__dirname, "result-service.ts");
const src = readFileSync(resultServicePath, "utf8");
assert.ok(!/fotorankJudgeVote/i.test(src));
assert.ok(!/FotorankJudgeVote/.test(src));

section("5. readiness module exists");
const readinessPath = join(__dirname, "publication-readiness.ts");
const rsrc = readFileSync(readinessPath, "utf8");
assert.ok(rsrc.includes("evaluateResultPublicationReadiness"));
assert.ok(rsrc.includes("RUBRIC_NOT_CONFIRMED"));
assert.ok(rsrc.includes("LEGAL_APPROVAL_MISSING"));

console.log("\npublication.selfcheck: OK");
