/**
 * Smoke del manual operativo de publicación.
 * pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/editorial-publish-manual.test.ts
 */
import assert from "node:assert/strict";
import {
  PUBLISH_MANUAL,
  getPublishManualOrigin,
} from "./editorial-publish-manual";

assert.equal(PUBLISH_MANUAL.origins.length, 4);
assert.ok(getPublishManualOrigin("web-intake"));
assert.ok(getPublishManualOrigin("clf-event"));
assert.ok(getPublishManualOrigin("clf-coverage"));
assert.ok(getPublishManualOrigin("from-scratch"));

for (const origin of PUBLISH_MANUAL.origins) {
  assert.ok(origin.steps.length >= 4, origin.id);
}

assert.ok(
  PUBLISH_MANUAL.warning.body.toLowerCase().includes("no") ||
    PUBLISH_MANUAL.warning.title.includes("≠"),
);
assert.ok(PUBLISH_MANUAL.commonSteps.length >= 5);
assert.ok(PUBLISH_MANUAL.redactorChecklist.length >= 3);
assert.ok(PUBLISH_MANUAL.directorChecklist.length >= 4);

console.log("editorial-publish-manual tests: ok");
