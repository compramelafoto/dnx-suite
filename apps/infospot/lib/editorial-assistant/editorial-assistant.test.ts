/**
 * Tests del Asistente Editorial (sin DB).
 * pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/editorial-assistant/editorial-assistant.test.ts
 */
import assert from "node:assert/strict";
import {
  ASSISTANT_TIMELINE,
  buildDraftContentStub,
  buildEventCardsFromCoverages,
  entryStepForIntent,
  eventStatusLabel,
  filterEventCards,
  hasPendingAssistantWork,
  materialSummary,
  nextStep,
  photoSelectionSummary,
  prevStep,
  storyTypeLabel,
  timelineForIntent,
  createEmptyAssistantState,
} from "./index";

assert.ok(ASSISTANT_TIMELINE.length >= 6);
assert.equal(entryStepForIntent("independent"), "draft");
assert.equal(entryStepForIntent("coverage"), "material");
assert.equal(entryStepForIntent("event"), "event");
assert.equal(entryStepForIntent("gallery"), "material");

const independentSteps = timelineForIntent("independent");
assert.deepEqual(
  independentSteps.map((s) => s.id),
  ["intent", "draft", "summary"],
);

assert.equal(nextStep("event", "intent"), "event");
assert.equal(nextStep("event", "event"), "material");
assert.equal(prevStep("event", "material"), "event");
assert.equal(nextStep("independent", "draft"), "summary");

const coverages = [
  {
    id: "c1",
    title: "Cobertura A",
    eventTitle: "Rosario Classic",
    city: "Rosario",
    photoCount: 100,
    commercialStatus: "AVAILABLE",
    coverThumbnailUrl: null,
    clfAlbumId: 1,
    clfEventId: 10,
    lastSyncedAt: null,
    photographers: [{ displayName: "Ana" }, { displayName: "Luis" }],
  },
  {
    id: "c2",
    title: "Cobertura B",
    eventTitle: "Rosario Classic",
    city: "Rosario",
    photoCount: 45,
    commercialStatus: "AVAILABLE",
    coverThumbnailUrl: "/x.jpg",
    clfAlbumId: 2,
    clfEventId: 10,
    lastSyncedAt: null,
    photographers: [{ displayName: "Ana" }],
  },
];

const events = buildEventCardsFromCoverages(coverages);
assert.equal(events.length, 1);
assert.equal(events[0]!.title, "Rosario Classic");
assert.equal(events[0]!.coverageCount, 2);
assert.equal(events[0]!.photographerCount, 2);
assert.equal(events[0]!.photoCount, 145);

const filtered = filterEventCards(events, { q: "rosario" });
assert.equal(filtered.length, 1);
assert.equal(filterEventCards(events, { q: "cordoba" }).length, 0);

const summary = materialSummary(
  coverages.map((c) => ({
    ...c,
    photographerNames: c.photographers.map((p) => p.displayName),
  })),
);
assert.equal(summary.coverageCount, 2);
assert.equal(summary.photographerCount, 2);
assert.equal(summary.photoCount, 145);

const photos = photoSelectionSummary([
  { role: "COVER" },
  { role: "GALLERY" },
  { role: "GALLERY" },
  { role: "INLINE" },
]);
assert.equal(photos.cover, 1);
assert.equal(photos.gallery, 2);
assert.equal(photos.inline, 1);

assert.equal(storyTypeLabel("cronica"), "Crónica");
assert.equal(
  eventStatusLabel({
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    endsAt: null,
  }),
  "Próximo",
);

const stub = buildDraftContentStub({
  storyTypeLabel: "Cobertura",
  eventTitle: "Rosario Classic",
  coverageTitles: ["Cobertura A"],
  photographerNames: ["Ana"],
});
assert.ok(stub.includes("Rosario Classic"));
assert.ok(stub.includes("Ana"));

const empty = createEmptyAssistantState();
assert.equal(hasPendingAssistantWork(empty), false);
assert.equal(
  hasPendingAssistantWork({
    ...empty,
    intent: "event",
    draft: { ...empty.draft, title: "Hola" },
  }),
  true,
);

console.log("editorial-assistant tests: ok");
