/**
 * Tests sync inbound CLF → InfoSpotEvent.
 * Ejecutar: pnpm --filter infospot test:clf-event-sync
 */

import assert from "node:assert/strict";
import { prisma } from "@repo/db";
import {
  assertExhaustiveCategoryMap,
  CLF_EVENT_TYPES,
  mapClfEventTypeToInfoSpotCategorySlug,
} from "./category-map";
import {
  isClfEventImportable,
  isClfEventPublicPhotographerCall,
  hasUsableCoordinates,
} from "./import-rules";
import { normalizeClfEvent } from "./normalize";
import { syncClfEventToInfoSpot } from "./sync";
import { reconcilePublicClfEvents } from "./reconcile";
import { buildClfPublicEventUrl, publicEventJoinPath } from "./urls";
import type { ClfEventForSync } from "./types";
import { dryRunBackfillSoftRefsToContentOrigin } from "../content-origin";

function baseClfEvent(overrides: Partial<ClfEventForSync> = {}): ClfEventForSync {
  return {
    id: 880001 + Math.floor(Math.random() * 100000),
    title: "Carrera solidaria Rosario",
    description: "Descripción operativa del evento CLF para sync de agenda.",
    type: "SPORTS",
    startsAt: new Date("2026-09-01T15:00:00.000Z"),
    endsAt: new Date("2026-09-01T19:00:00.000Z"),
    latitude: -32.9442,
    longitude: -60.6505,
    locationName: "Parque Independencia",
    city: "Rosario",
    visibility: "PUBLIC",
    joinPolicy: "OPEN",
    maxPhotographers: 10,
    shareSlug: `sync-test-${Date.now()}`,
    coverImageKey: null,
    status: "ACTIVE",
    archivedAt: null,
    updatedAt: new Date(),
    createdAt: new Date(),
    creator: {
      id: 1,
      name: "Org Test",
      email: "org-sync-test@example.com",
      phone: null,
      website: null,
      city: "Rosario",
      province: "Santa Fe",
      companyName: "Org Test SA",
    },
    activePhotographerCount: 2,
    ...overrides,
  };
}

// --- Puros ---

assertExhaustiveCategoryMap();
for (const t of CLF_EVENT_TYPES) {
  const mapped = mapClfEventTypeToInfoSpotCategorySlug(t);
  assert.equal(mapped.usedFallback, false, t);
  assert.ok(mapped.slug.length > 0, t);
}
{
  const fb = mapClfEventTypeToInfoSpotCategorySlug("NOT_A_REAL_TYPE");
  assert.equal(fb.usedFallback, true);
  assert.equal(fb.slug, "eventos");
}

assert.equal(isClfEventImportable(baseClfEvent()).importable, true);
assert.equal(
  isClfEventImportable(baseClfEvent({ visibility: "PRIVATE" })).importable,
  false,
);
assert.equal(
  isClfEventImportable(baseClfEvent({ shareSlug: null })).importable,
  false,
);
assert.equal(
  isClfEventImportable(baseClfEvent({ archivedAt: new Date() })).importable,
  false,
);

assert.equal(
  isClfEventPublicPhotographerCall(baseClfEvent()),
  true,
);
assert.equal(
  isClfEventPublicPhotographerCall(
    baseClfEvent({ maxPhotographers: 2, activePhotographerCount: 2 }),
  ),
  false,
);
assert.equal(
  isClfEventPublicPhotographerCall(baseClfEvent({ status: "CLOSED" })),
  false,
);

assert.equal(hasUsableCoordinates(-32.9, -60.6), true);
assert.equal(hasUsableCoordinates(0, 0), false);

assert.equal(publicEventJoinPath("abc"), "/e/abc");
assert.ok(buildClfPublicEventUrl("abc")?.endsWith("/e/abc"));

{
  const n = normalizeClfEvent(baseClfEvent({ latitude: 0, longitude: 0 }));
  assert.equal(n.missingGeoref, true);
  assert.ok(n.warnings.some((w) => w.code === "missing_georef"));
  assert.equal(n.latitude, null);
}
{
  const n = normalizeClfEvent(baseClfEvent());
  assert.equal(n.missingGeoref, false);
  assert.ok(n.latitude != null);
  assert.equal(n.operationalPayload.joinPolicy, "OPEN");
  assert.equal(n.publicPhotographerCall, true);
}

console.log("clf-event-sync pure tests: ok");

async function persistence() {
  const createdIds: string[] = [];
  const clf = baseClfEvent({ id: 891001 });

  try {
    // 1 create DRAFT
    const created = await syncClfEventToInfoSpot(clf, { dryRun: false });
    if (!created.ok) throw new Error(created.error);
    assert.equal(created.action, "created");
    assert.ok(created.infoSpotEventId);
    createdIds.push(created.infoSpotEventId);

    const event = await prisma.infoSpotEvent.findUnique({
      where: { id: created.infoSpotEventId! },
    });
    assert.equal(event?.status, "DRAFT");
    assert.equal(event?.originKind, "IMPORTED");
    assert.equal(event?.contentTag, "NEEDS_REVIEW");
    assert.equal(event?.city, "Rosario");
    assert.ok(event?.registrationUrl?.includes("/e/"));

    const origin = await prisma.infoSpotContentOrigin.findFirst({
      where: { eventId: event!.id, contentType: "EVENT" },
    });
    assert.equal(origin?.syncStatus, "SYNCED");
    assert.equal(origin?.direction, "INBOUND");

    // 2 private not imported as new
    const priv = await syncClfEventToInfoSpot(
      baseClfEvent({ id: 891002, visibility: "PRIVATE" }),
      { dryRun: false },
    );
    assert.equal(priv.ok, true);
    if (priv.ok) assert.equal(priv.action, "skipped");

    // 3 no shareSlug
    const noslug = await syncClfEventToInfoSpot(
      baseClfEvent({ id: 891003, shareSlug: null }),
      { dryRun: false },
    );
    assert.equal(noslug.ok, true);
    if (noslug.ok) assert.equal(noslug.action, "skipped");

    // 4 second sync no duplicate
    const again = await syncClfEventToInfoSpot(clf, { dryRun: false });
    if (!again.ok) throw new Error(again.error);
    assert.ok(again.action === "unchanged" || again.action === "updated");
    assert.equal(again.infoSpotEventId, created.infoSpotEventId);
    const count = await prisma.infoSpotContentOrigin.count({
      where: {
        contentType: "EVENT",
        sourceType: "COMPRAMELAFOTO",
        externalEntityType: "EVENT",
        externalId: String(clf.id),
      },
    });
    assert.equal(count, 1);

    // 5 date change updates
    const moved = await syncClfEventToInfoSpot(
      {
        ...clf,
        startsAt: new Date("2026-10-01T15:00:00.000Z"),
        updatedAt: new Date(),
      },
      { dryRun: false },
    );
    if (!moved.ok) throw new Error(moved.error);
    assert.equal(moved.action, "updated");
    const afterDate = await prisma.infoSpotEvent.findUnique({
      where: { id: created.infoSpotEventId! },
    });
    assert.equal(afterDate?.startAt.toISOString(), "2026-10-01T15:00:00.000Z");
    assert.equal(afterDate?.status, "DRAFT");

    // 6 title override
    await prisma.infoSpotEvent.update({
      where: { id: created.infoSpotEventId! },
      data: { title: "Título editorial", titleOverridden: true },
    });
    const titleSync = await syncClfEventToInfoSpot(
      { ...clf, title: "Título CLF nuevo", updatedAt: new Date() },
      { dryRun: false },
    );
    assert.equal(titleSync.ok, true);
    const afterTitle = await prisma.infoSpotEvent.findUnique({
      where: { id: created.infoSpotEventId! },
    });
    assert.equal(afterTitle?.title, "Título editorial");

    // 7 cover override
    await prisma.infoSpotEvent.update({
      where: { id: created.infoSpotEventId! },
      data: {
        coverImageUrl: "https://example.com/editorial.jpg",
        coverImageKey: "editorial-key",
        coverOverridden: true,
      },
    });
    await syncClfEventToInfoSpot(
      {
        ...clf,
        coverImageKey: "clf-cover-key",
        updatedAt: new Date(),
      },
      { dryRun: false },
    );
    const afterCover = await prisma.infoSpotEvent.findUnique({
      where: { id: created.infoSpotEventId! },
    });
    assert.equal(afterCover?.coverImageKey, "editorial-key");

    // 8 category override
    await prisma.infoSpotEvent.update({
      where: { id: created.infoSpotEventId! },
      data: { categoryOverridden: true },
    });
    const catBefore = afterCover?.categoryId;
    await syncClfEventToInfoSpot(
      { ...clf, type: "CONCERT", updatedAt: new Date() },
      { dryRun: false },
    );
    const afterCat = await prisma.infoSpotEvent.findUnique({
      where: { id: created.infoSpotEventId! },
    });
    assert.equal(afterCat?.categoryId, catBefore);

    // 9 CLOSED keeps fiche
    const closed = await syncClfEventToInfoSpot(
      { ...clf, status: "CLOSED", updatedAt: new Date() },
      { dryRun: false },
    );
    assert.equal(closed.ok, true);
    const afterClosed = await prisma.infoSpotEvent.findUnique({
      where: { id: created.infoSpotEventId! },
    });
    assert.equal(afterClosed?.status, "DRAFT");
    assert.ok(afterClosed);

    // 10 archived → stale
    const archived = await syncClfEventToInfoSpot(
      { ...clf, archivedAt: new Date(), updatedAt: new Date() },
      { dryRun: false },
    );
    assert.equal(archived.ok, true);
    if (archived.ok) assert.equal(archived.action, "stale");
    const staleOrigin = await prisma.infoSpotContentOrigin.findFirst({
      where: { eventId: created.infoSpotEventId! },
    });
    assert.equal(staleOrigin?.syncStatus, "STALE");

    // Reopen for remaining tests: clear archive + mark synced
    await prisma.infoSpotContentOrigin.update({
      where: { id: staleOrigin!.id },
      data: { syncStatus: "SYNCED", syncError: null },
    });

    // 11 private withdraws URL
    const unlisted = await syncClfEventToInfoSpot(
      {
        ...clf,
        visibility: "PRIVATE",
        archivedAt: null,
        updatedAt: new Date(),
      },
      { dryRun: false },
    );
    assert.equal(unlisted.ok, true);
    const afterPriv = await prisma.infoSpotEvent.findUnique({
      where: { id: created.infoSpotEventId! },
    });
    assert.equal(afterPriv?.registrationUrl, null);
    assert.equal(afterPriv?.status, "DRAFT");

    // 22 status never changes + 23 SYNCED after recovery from FAILED
    await prisma.infoSpotContentOrigin.updateMany({
      where: { eventId: created.infoSpotEventId! },
      data: { syncStatus: "FAILED", syncError: "boom" },
    });
    const recover = await syncClfEventToInfoSpot(
      { ...clf, visibility: "PUBLIC", archivedAt: null, updatedAt: new Date() },
      { dryRun: false },
    );
    assert.equal(recover.ok, true);
    const recoveredOrigin = await prisma.infoSpotContentOrigin.findFirst({
      where: { eventId: created.infoSpotEventId! },
    });
    assert.equal(recoveredOrigin?.syncStatus, "SYNCED");
    const statusCheck = await prisma.infoSpotEvent.findUnique({
      where: { id: created.infoSpotEventId! },
      select: { status: true },
    });
    assert.equal(statusCheck?.status, "DRAFT");

    // 18 dry-run no write
    const beforeCount = await prisma.infoSpotEvent.count({
      where: { originKind: "IMPORTED" },
    });
    const dry = await syncClfEventToInfoSpot(
      baseClfEvent({ id: 891099, shareSlug: `dry-${Date.now()}` }),
      { dryRun: true },
    );
    assert.equal(dry.ok, true);
    if (dry.ok) assert.equal(dry.action, "created");
    const afterCount = await prisma.infoSpotEvent.count({
      where: { originKind: "IMPORTED" },
    });
    assert.equal(afterCount, beforeCount);

    // 21 error in batch does not abort
    const batch = await reconcilePublicClfEvents({
      dryRun: true,
      eventId: 999999001,
    });
    assert.equal(batch.failed, 1);
    assert.equal(batch.scanned, 1);

    // 16 soft-ref dry-run still safe
    const soft = await dryRunBackfillSoftRefsToContentOrigin({ dryRun: true, take: 10 });
    assert.equal(soft.dryRun, true);

    console.log("clf-event-sync persistence tests: ok");
  } finally {
    for (const id of createdIds) {
      await prisma.infoSpotContentOrigin.deleteMany({ where: { eventId: id } });
      await prisma.infoSpotEvent.delete({ where: { id } }).catch(() => undefined);
    }
  }
}

persistence()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
