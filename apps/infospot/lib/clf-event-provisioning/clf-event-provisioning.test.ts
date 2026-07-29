/**
 * Tests provisioning outbound (puros + persistencia si hay escritura CLF).
 * pnpm --filter infospot test:clf-event-provisioning
 */

import { loadCliEnv } from "../clf-event-sync/load-env";
loadCliEnv();
process.env.ALLOW_CLF_WRITE_FROM_INFOSPOT =
  process.env.ALLOW_CLF_WRITE_FROM_INFOSPOT || "true";

import assert from "node:assert/strict";
import { prisma, getClfWriteConnectionInfo, getClfWriteClient, disconnectClfWriteClient } from "@repo/db";
import {
  mapInfoSpotCategoryToClfEventType,
  isValidClfEventType,
  CLF_EVENT_TYPES,
} from "./category-type-map";
import { validateEventForClfProvisioning } from "./validate";
import {
  upsertPhotographerCallDraft,
  provisionClfEventFromInfoSpot,
  closeClfPhotographerCall,
} from "./provision";
import { normalizeVisibilityJoinPolicy } from "@repo/db/clf-event-write";

// --- Puros ---
{
  assert.equal(mapInfoSpotCategoryToClfEventType("deportes").type, "SPORTS");
  assert.equal(mapInfoSpotCategoryToClfEventType("cultura").type, "CONCERT");
  assert.equal(mapInfoSpotCategoryToClfEventType(null).type, "OTHER");
  for (const t of CLF_EVENT_TYPES) assert.equal(isValidClfEventType(t), true);
  assert.equal(isValidClfEventType("RUNNING"), false);

  const open = normalizeVisibilityJoinPolicy({ visibility: "PRIVATE", joinPolicy: "OPEN" });
  assert.equal(open.visibility, "PUBLIC");
  assert.equal(open.joinPolicy, "OPEN");
  const req = normalizeVisibilityJoinPolicy({ visibility: "PUBLIC", joinPolicy: "REQUEST" });
  assert.equal(req.joinPolicy, "REQUEST");
  assert.equal(req.visibility, "PUBLIC");
  const inv = normalizeVisibilityJoinPolicy({ visibility: "PUBLIC", joinPolicy: "INVITE_ONLY" });
  assert.equal(inv.joinPolicy, "INVITE_ONLY");
  assert.ok(inv.visibility === "UNLISTED" || inv.visibility === "PRIVATE");
}

{
  const baseEvent = {
    title: "Test",
    city: "Rosario",
    startAt: new Date(),
    latitude: -32.9,
    longitude: -60.6,
    status: "DRAFT",
    locationConfirmedAt: new Date(),
    geocodingStatus: "CONFIRMED",
  };
  const baseCall = {
    enabled: true,
    visibility: "PUBLIC" as const,
    joinPolicy: "OPEN" as const,
    clfEventType: "SPORTS" as const,
    ownershipStatus: "RESOLVED" as const,
    organizerUserId: 1,
  };
  assert.equal(
    validateEventForClfProvisioning({
      event: baseEvent,
      call: { ...baseCall, enabled: false },
      identity: {
        ownershipStatus: "RESOLVED",
        organizerUserId: 1,
        organizerEmail: "a@b.com",
        provisioningBlockedReason: null,
      },
    }).ok,
    false,
  );
  const noOrg = validateEventForClfProvisioning({
    event: baseEvent,
    call: { ...baseCall, ownershipStatus: "BLOCKED", organizerUserId: null },
    identity: {
      ownershipStatus: "BLOCKED",
      organizerUserId: null,
      organizerEmail: "a@b.com",
      provisioningBlockedReason: "Falta",
    },
  });
  assert.equal(noOrg.ok, false);
  if (!noOrg.ok) assert.equal(noOrg.status, "BLOCKED");

  const noGeo = validateEventForClfProvisioning({
    event: { ...baseEvent, latitude: null, longitude: null },
    call: baseCall,
    identity: {
      ownershipStatus: "RESOLVED",
      organizerUserId: 1,
      organizerEmail: "a@b.com",
      provisioningBlockedReason: null,
    },
  });
  assert.equal(noGeo.ok, false);

  const unconfirmed = validateEventForClfProvisioning({
    event: { ...baseEvent, locationConfirmedAt: null },
    call: baseCall,
    identity: {
      ownershipStatus: "RESOLVED",
      organizerUserId: 1,
      organizerEmail: "a@b.com",
      provisioningBlockedReason: null,
    },
  });
  assert.equal(unconfirmed.ok, false);
}

console.log("clf-event-provisioning pure tests: ok");

async function persistence() {
  const author = await prisma.user.findFirst({ select: { id: true, email: true } });
  if (!author) throw new Error("Sin User");

  const event = await prisma.infoSpotEvent.create({
    data: {
      title: "Provisioning test event",
      slug: `prov-test-${Date.now()}`,
      description: "Descripción suficientemente larga para el evento de prueba outbound.",
      organizerName: "Org Test",
      organizerEmail: author.email,
      city: "Rosario",
      province: "Santa Fe",
      startAt: new Date(Date.now() + 86400000 * 40),
      latitude: -32.9442,
      longitude: -60.6505,
      venueName: "Parque",
      status: "DRAFT",
      originKind: "REDACCION",
      contentTag: "NEEDS_REVIEW",
      authorId: author.id,
      geocodingStatus: "CONFIRMED",
      locationConfirmedAt: new Date(),
      locationPrecision: "COORDINATE",
      countryCode: "AR",
      countryName: "Argentina",
    },
  });

  let createdClfEventId: number | null = null;
  try {
    // 1 sin convocatoria no provisiona
    const skip = await provisionClfEventFromInfoSpot(event.id, author.id);
    assert.equal(skip.ok, true);
    if (skip.ok) assert.equal(skip.action, "skipped");

    process.env.ALLOW_CLF_WRITE_FROM_INFOSPOT = "true";
    const writeNow = getClfWriteConnectionInfo();
    if (!writeNow.configured) {
      console.log("clf-event-provisioning persistence: skipped write (CLF write no configurada)");
      return;
    }

    const clf = getClfWriteClient();
    const clfUser = await clf.user.findFirst({
      where: { isBlocked: false },
      select: { id: true, email: true },
      orderBy: { id: "asc" },
    });
    if (!clfUser) {
      console.log("clf-event-provisioning persistence: skipped (sin User en CLF)");
      return;
    }

    await upsertPhotographerCallDraft(event.id, {
      enabled: true,
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
      maxPhotographers: 5,
      photographerTerms: "Términos test",
      operationalDescription: "Ops desc",
      clfEventType: "SPORTS",
      desiredClfStatus: "ACTIVE",
      organizerEmail: clfUser.email,
      actorUserId: author.id,
    });

    const call = await prisma.infoSpotPhotographerCall.findUnique({
      where: { eventId: event.id },
    });
    assert.equal(call?.enabled, true);
    assert.equal(call?.maxPhotographers, 5);

    const first = await provisionClfEventFromInfoSpot(event.id, author.id);
    if (!first.ok && first.action === "blocked") {
      console.log("clf-event-provisioning blocked (organizador):", first.error);
      return;
    }
    if (!first.ok) throw new Error(first.error);
    assert.ok(first.clfEventId);
    createdClfEventId = first.clfEventId;
    assert.ok(first.publicUrl?.includes("/e/"));
    assert.ok(first.action === "created" || first.action === "updated");

    const origin = await prisma.infoSpotContentOrigin.findFirst({
      where: { eventId: event.id, contentType: "EVENT" },
    });
    assert.equal(origin?.direction, "BIDIRECTIONAL");
    assert.equal(origin?.externalId, String(first.clfEventId));

    // second no duplicate
    const second = await provisionClfEventFromInfoSpot(event.id, author.id);
    assert.equal(second.ok, true);
    if (second.ok) assert.equal(second.clfEventId, first.clfEventId);

    // close
    const closed = await closeClfPhotographerCall(event.id, author.id);
    assert.equal(closed.ok, true);
    const afterClose = await prisma.infoSpotPhotographerCall.findUnique({
      where: { eventId: event.id },
    });
    assert.equal(afterClose?.provisioningStatus, "CLOSED");
    assert.ok(afterClose?.clfEventId);

    console.log("clf-event-provisioning persistence tests: ok", {
      clfEventId: first.clfEventId,
      publicUrl: first.publicUrl,
    });
  } finally {
    await prisma.infoSpotPhotographerCall.deleteMany({ where: { eventId: event.id } });
    await prisma.infoSpotContentOrigin.deleteMany({ where: { eventId: event.id } });
    await prisma.infoSpotEvent.delete({ where: { id: event.id } }).catch(() => undefined);
    if (createdClfEventId) {
      try {
        const clf = getClfWriteClient();
        await clf.event.delete({ where: { id: createdClfEventId } }).catch(() => undefined);
      } catch {
        /* ignore */
      }
    }
    await disconnectClfWriteClient().catch(() => undefined);
  }
}

persistence()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
