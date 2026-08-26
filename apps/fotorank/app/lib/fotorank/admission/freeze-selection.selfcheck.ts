/**
 * Selfcheck freeze selectivo + selection hash — sin DB.
 * pnpm --filter fotorank run test:admission:freeze-selection
 */
import assert from "node:assert/strict";
import {
  assertSelectionHashMatch,
  buildFreezeSelectionHash,
} from "./selection-hash";
import { assertAnonymousPayloadClean, buildAnonymousJuryPayload } from "./anonymity";

const h1 = buildFreezeSelectionHash({
  contestId: "c1",
  categorySlugs: ["fotografo-amateur", "fotografo-profesional"],
  entryIds: ["e2", "e1"],
  expectedCount: 2,
});
const h2 = buildFreezeSelectionHash({
  contestId: "c1",
  categorySlugs: ["fotografo-profesional", "fotografo-amateur"],
  entryIds: ["e1", "e2"],
  expectedCount: 2,
});
assert.equal(h1, h2, "hash estable ante reorden");
assert.match(h1, /^sha256:v1:[a-f0-9]{64}$/);

const h3 = buildFreezeSelectionHash({
  contestId: "c1",
  categorySlugs: ["fotografo-amateur"],
  entryIds: ["e1", "e2"],
  expectedCount: 2,
});
assert.notEqual(h1, h3, "categoría distinta cambia hash");

assert.throws(
  () =>
    buildFreezeSelectionHash({
      contestId: "c1",
      categorySlugs: [],
      entryIds: ["e1"],
      expectedCount: 2,
    }),
  /SELECTION_COUNT_MISMATCH/,
);

assert.throws(() => assertSelectionHashMatch(h1, h3), /SELECTION_HASH_MISMATCH/);
assertSelectionHashMatch(h1, h1);

const payload = buildAnonymousJuryPayload({
  anonymousCode: "AMA-1000",
  categorySlug: "fotografo-amateur",
  categoryName: "Amateur",
  title: "T",
  description: null,
  hasJuryAsset: true,
  entryId: "e1",
});
assert.deepEqual(assertAnonymousPayloadClean(payload as unknown as Record<string, unknown>), []);
assert.ok(
  assertAnonymousPayloadClean({
    ...payload,
    email: "x@y.com",
  } as unknown as Record<string, unknown>).includes("email"),
);

// Regla de producto: apply sin scope explícito debe fallar (simulada)
function requireScope(categorySlugs?: string[], entryIds?: string[]) {
  if (!categorySlugs?.length && !entryIds?.length) throw new Error("SELECTION_REQUIRED");
}
assert.throws(() => requireScope(undefined, undefined), /SELECTION_REQUIRED/);
requireScope(["fotografo-amateur"], undefined);

console.log("freeze-selection.selfcheck: OK");
