/**
 * pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/lib/public/public-events.test.ts
 */

import assert from "node:assert/strict";
import { EventVisibility } from "@prisma/client";
import {
  PUBLIC_EVENT_DETAIL_FIELDS,
  PUBLIC_EVENT_FORBIDDEN_FIELDS,
  PUBLIC_EVENT_LIST_FIELDS,
  buildListableEventsWhere,
  canAccessEventByShareSlug,
  canListEventPublicly,
  sanitizeEventInterestPayload,
  toPublicEventDetail,
} from "./public-events";

{
  assert.equal(
    canListEventPublicly({ visibility: EventVisibility.PUBLIC, archivedAt: null }),
    true
  );
  assert.equal(
    canListEventPublicly({ visibility: EventVisibility.UNLISTED, archivedAt: null }),
    false
  );
  assert.equal(
    canListEventPublicly({ visibility: EventVisibility.PRIVATE, archivedAt: null }),
    false
  );
  assert.equal(
    canListEventPublicly({
      visibility: EventVisibility.PUBLIC,
      archivedAt: new Date(),
    }),
    false
  );
}

{
  assert.equal(
    canAccessEventByShareSlug({
      visibility: EventVisibility.PUBLIC,
      archivedAt: null,
    }),
    true
  );
  assert.equal(
    canAccessEventByShareSlug({
      visibility: EventVisibility.UNLISTED,
      archivedAt: null,
    }),
    true
  );
  assert.equal(
    canAccessEventByShareSlug({
      visibility: EventVisibility.PRIVATE,
      archivedAt: null,
    }),
    false
  );
  assert.equal(
    canAccessEventByShareSlug({
      visibility: EventVisibility.UNLISTED,
      archivedAt: new Date(),
    }),
    false
  );
}

{
  const where = buildListableEventsWhere("  Rosario  ");
  assert.equal(where.visibility, EventVisibility.PUBLIC);
  assert.equal(where.archivedAt, null);
  assert.ok(where.OR);
  assert.equal(where.OR!.length, 5);
}

{
  const detail = toPublicEventDetail({
    id: 1,
    title: "Maratón",
    description: "Desc",
    type: "SPORTS",
    status: "ACTIVE",
    visibility: EventVisibility.PUBLIC,
    startsAt: new Date("2026-08-01T00:00:00Z"),
    endsAt: null,
    locationName: "Parque",
    city: "Rosario",
    accreditationNotes: null,
    photographerTerms: "Términos",
    uploadsEnabled: true,
    maxPhotographers: 10,
    expectedAttendees: 1000,
    joinPolicy: "OPEN",
    membersCount: 3,
    coverUrl: "https://example.com/c.jpg",
  });
  assert.equal(detail.title, "Maratón");
  assert.equal(detail.membersCount, 3);
  assert.ok(!("creatorId" in detail));
  assert.ok(!("latitude" in detail));
  assert.ok(!("organizerCommissionPercentage" in detail));
  assert.ok(PUBLIC_EVENT_DETAIL_FIELDS.includes("coverUrl"));
  assert.ok(PUBLIC_EVENT_LIST_FIELDS.includes("joinUrl"));
  assert.ok(PUBLIC_EVENT_FORBIDDEN_FIELDS.includes("rulesData"));
  assert.ok(PUBLIC_EVENT_FORBIDDEN_FIELDS.includes("fixedPhotoPrice"));
}

{
  const bad = sanitizeEventInterestPayload({ name: "", email: "a@b.com" });
  assert.equal(bad.ok, false);

  const badEmail = sanitizeEventInterestPayload({
    name: "Ana",
    email: "no-email",
  });
  assert.equal(badEmail.ok, false);

  const ok = sanitizeEventInterestPayload({
    name: " Ana ",
    lastName: "Pérez",
    email: " Ana@Mail.COM ",
    whatsapp: "341",
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.name, "Ana");
    assert.equal(ok.email, "ana@mail.com");
    assert.equal(ok.lastName, "Pérez");
  }
}

console.log("public-events.test.ts: ok");
