/**
 * Tests del motor de distribución de home.
 * pnpm --filter infospot test:distribution
 */

import assert from "node:assert/strict";
import {
  isPubliclyDistributable,
  publicPublishedEventWhere,
  calculateEventRelevanceScore,
  getEventTemporalState,
  resolvePhotographerCallFromSources,
  isSafeExternalRedirect,
} from "./index";
import { isClfEventPublicPhotographerCall } from "../clf-event-sync/import-rules";

// Regla pública ETAPA 15: solo status=PUBLISHED (sin filtro contentTag)
{
  assert.equal(isPubliclyDistributable({ status: "PUBLISHED" }), true);
  assert.equal(isPubliclyDistributable({ status: "PUBLISHED", contentTag: "REAL" }), true);
  // ETAPA 15: DEMO PUBLISHED sería público (la migración SQL previene que exista)
  assert.equal(isPubliclyDistributable({ status: "PUBLISHED", contentTag: "DEMO" }), true);
  assert.equal(isPubliclyDistributable({ status: "DRAFT", contentTag: "REAL" }), false);
  assert.equal(isPubliclyDistributable({ status: "IN_REVIEW", contentTag: "REAL" }), false);
  assert.equal(isPubliclyDistributable({ status: "READY_TO_PUBLISH", contentTag: "REAL" }), false);
  assert.equal(isPubliclyDistributable({ status: "UNPUBLISHED", contentTag: "REAL" }), false);
  assert.equal(isPubliclyDistributable({ status: "ARCHIVED", contentTag: "REAL" }), false);
  assert.equal(
    isPubliclyDistributable({ status: "PUBLISHED", excludeFromHomepage: true }),
    false,
  );
  const where = publicPublishedEventWhere();
  assert.equal(where.status, "PUBLISHED");
  // ETAPA 15: contentTag ausente del where público
  assert.ok(!("contentTag" in where), "contentTag no debe estar en where público");
  assert.equal(where.excludeFromHomepage, false);
}

// temporal
{
  const now = new Date("2026-07-12T15:00:00.000Z");
  assert.equal(
    getEventTemporalState({
      startAt: new Date("2026-07-20T15:00:00.000Z"),
      now,
    }),
    "UPCOMING",
  );
  assert.equal(
    getEventTemporalState({
      startAt: new Date("2026-06-01T15:00:00.000Z"),
      endAt: new Date("2026-06-02T15:00:00.000Z"),
      now,
    }),
    "FINISHED",
  );
}

// score + prioridad editorial
{
  const base = {
    startAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    coverImageUrl: "https://example.com/x.jpg",
    locationConfirmedAt: new Date(),
    categoryId: "c1",
    description: "Descripción suficientemente larga para el score de completitud.",
    registrationUrl: "https://compramelafoto.com/e/abc",
    publishedAt: new Date(),
  };
  const low = calculateEventRelevanceScore({ ...base, editorialPriority: 0 });
  const high = calculateEventRelevanceScore({ ...base, editorialPriority: 80 });
  assert.ok(high.total > low.total);
  assert.ok(high.editorialPriorityScore > low.editorialPriorityScore);
}

// convocatoria
{
  assert.equal(
    isClfEventPublicPhotographerCall({
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
      archivedAt: null,
      shareSlug: "abc",
      status: "ACTIVE",
      maxPhotographers: 10,
      activePhotographerCount: 10,
    }),
    false,
  );
  assert.equal(
    isClfEventPublicPhotographerCall({
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
      archivedAt: null,
      shareSlug: "abc",
      status: "CLOSED",
      maxPhotographers: null,
    }),
    false,
  );
  assert.equal(
    isClfEventPublicPhotographerCall({
      visibility: "PRIVATE",
      joinPolicy: "OPEN",
      archivedAt: null,
      shareSlug: "abc",
      status: "ACTIVE",
      maxPhotographers: null,
    }),
    false,
  );

  const ok = resolvePhotographerCallFromSources({
    origin: {
      externalId: "1",
      externalUrl: "https://compramelafoto.com/e/slug-ok",
      operationalPayload: {
        visibility: "PUBLIC",
        joinPolicy: "OPEN",
        status: "ACTIVE",
        shareSlug: "slug-ok",
        archivedAt: null,
        maxPhotographers: null,
      },
    },
  });
  assert.equal(ok.eligible, true);
  assert.ok(ok.joinUrl?.includes("/e/slug-ok"));

  const full = resolvePhotographerCallFromSources({
    origin: {
      externalId: "1",
      externalUrl: "https://compramelafoto.com/e/full",
      operationalPayload: {
        visibility: "PUBLIC",
        joinPolicy: "OPEN",
        status: "ACTIVE",
        shareSlug: "full",
        maxPhotographers: 2,
        activePhotographerCount: 2,
      },
    },
  });
  assert.equal(full.eligible, false);
}

// open redirect
{
  assert.equal(
    isSafeExternalRedirect("https://compramelafoto.com/e/x", [
      "https://compramelafoto.com",
    ]),
    true,
  );
  assert.equal(
    isSafeExternalRedirect("https://evil.example/phish", [
      "https://compramelafoto.com",
    ]),
    false,
  );
  assert.equal(
    isSafeExternalRedirect("javascript:alert(1)", ["https://compramelafoto.com"]),
    false,
  );
}

console.log("distribution tests: ok");
