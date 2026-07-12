/**
 * Tests ContentOrigin (puros + persistencia en staging si el schema está migrado).
 * Ejecutar: pnpm --filter infospot test:content-origin
 */

import assert from "node:assert/strict";
import {
  assertOriginTarget,
  normalizeExternalId,
  ORIGIN_DIRECTIONS,
} from "./types";
import {
  ARTICLE_FIELD_OWNERSHIP,
  EVENT_FIELD_OWNERSHIP,
  isEditorialProtected,
  isSourceOwned,
  mergeOperationalFields,
} from "./field-ownership";
import {
  resolveCommercialAvailability,
} from "./commercial-availability";
import {
  comprameLaFotoAdapter,
  normalizeClfExternalIdentity,
} from "./adapters/compramelafoto";
import { dryRunBackfillSoftRefsToContentOrigin } from "./backfill-soft-refs";
import {
  findOriginByExternalIdentity,
  linkArticleToOrigin,
  linkEventToOrigin,
  markOriginFailed,
  markOriginStale,
  markOriginSynced,
  upsertContentOrigin,
} from "./service";
import { prisma } from "@repo/db";

// --- Puros ---

// 5/6 XOR target
{
  assert.equal(assertOriginTarget({ contentType: "ARTICLE" }).ok, false);
  assert.equal(
    assertOriginTarget({ contentType: "ARTICLE", articleId: "a", eventId: "e" }).ok,
    false,
  );
  const ok = assertOriginTarget({ contentType: "ARTICLE", articleId: "a1" });
  assert.equal(ok.ok, true);
  const okE = assertOriginTarget({ contentType: "EVENT", eventId: "e1" });
  assert.equal(okE.ok, true);
}

// 12 adapter identity
{
  const id = normalizeClfExternalIdentity("EVENT", 42);
  assert.equal(id.sourceType, "COMPRAMELAFOTO");
  assert.equal(id.externalEntityType, "EVENT");
  assert.equal(id.externalId, "42");
  assert.equal(normalizeExternalId(99), "99");
  const payload = comprameLaFotoAdapter.buildOperationalPayload({
    city: "Rosario",
    publicSlug: "album-x",
  });
  assert.equal(payload.city, "Rosario");
  assert.equal(payload.publicSlug, "album-x");
}

// 13/14/15 directions
assert.deepEqual([...ORIGIN_DIRECTIONS], ["INBOUND", "OUTBOUND", "BIDIRECTIONAL"]);
assert.equal(comprameLaFotoAdapter.defaultDirection, "INBOUND");

// Ownership / editorial untouched
{
  assert.equal(isSourceOwned("startAt", EVENT_FIELD_OWNERSHIP), true);
  assert.equal(isEditorialProtected("title", EVENT_FIELD_OWNERSHIP), true);
  assert.equal(isEditorialProtected("coverImageId", ARTICLE_FIELD_OWNERSHIP), true);
  const editorial = { title: "Editorial", summary: "Bajada" };
  const merged = mergeOperationalFields(
    editorial,
    { startAt: "2026-01-01", title: "NO", city: "CABA" },
    EVENT_FIELD_OWNERSHIP,
  );
  assert.equal(merged.editorialUntouched.title, "Editorial");
  assert.equal(merged.nextOperational.startAt, "2026-01-01");
  assert.equal(merged.nextOperational.city, "CABA");
  assert.equal("title" in merged.nextOperational, false);
}

// 16 commercial deleted
{
  const deleted = resolveCommercialAvailability({
    sourceType: "COMPRAMELAFOTO",
    externalEntityType: "ALBUM",
    syncStatus: "STALE",
    operationalPayload: { publicSlug: "x" },
    externalUrl: null,
  });
  assert.equal(deleted.canShowPurchaseCta, false);
  assert.equal(deleted.status, "UNPUBLISHED");

  const fromPayload = resolveCommercialAvailability({
    sourceType: "COMPRAMELAFOTO",
    externalEntityType: "EVENT",
    syncStatus: "SYNCED",
    operationalPayload: { deleted: true },
    externalUrl: null,
  });
  assert.equal(fromPayload.status, "DELETED");
}

console.log("content-origin pure tests: ok");

// --- Persistencia (requiere migración aplicada) ---
async function persistence() {
  const hasModel = typeof (prisma as { infoSpotContentOrigin?: { findMany?: unknown } })
    .infoSpotContentOrigin?.findMany === "function";
  if (!hasModel) {
    console.log("content-origin persistence: skipped (client sin modelo)");
    return;
  }

  const author = await prisma.user.findFirst({ select: { id: true } });
  if (!author) throw new Error("Sin User para tests");

  const article = await prisma.infoSpotArticle.create({
    data: {
      title: "Origin test article",
      slug: `origin-test-article-${Date.now()}`,
      content: "Contenido editorial de prueba suficientemente largo.",
      authorId: author.id,
      status: "DRAFT",
      contentTag: "NEEDS_REVIEW",
    },
  });

  const event = await prisma.infoSpotEvent.create({
    data: {
      title: "Origin test event",
      slug: `origin-test-event-${Date.now()}`,
      description: "Descripción de evento de prueba para origen.",
      organizerName: "Org",
      organizerEmail: "origin-test@example.com",
      city: "Rosario",
      province: "Santa Fe",
      startAt: new Date(Date.now() + 86400000),
      status: "DRAFT",
      originKind: "REDACCION",
      contentTag: "NEEDS_REVIEW",
    },
  });

  try {
    // 1 Article → CLF Album
    const linkAlbum = await linkArticleToOrigin(article.id, {
      sourceType: "COMPRAMELAFOTO",
      externalEntityType: "ALBUM",
      externalId: 900001,
      direction: "INBOUND",
      operationalPayload: { publicSlug: "test-album", commercialStatus: "AVAILABLE" },
    });
    if (!linkAlbum.ok) throw new Error(linkAlbum.error);
    assert.equal(linkAlbum.created, true);

    // 2 Event → CLF Event
    const linkEvent = await linkEventToOrigin(event.id, {
      sourceType: "COMPRAMELAFOTO",
      externalEntityType: "EVENT",
      externalId: 900002,
      direction: "BIDIRECTIONAL",
    });
    if (!linkEvent.ok) throw new Error(linkEvent.error);

    // 3 upsert no duplica
    const again = await linkArticleToOrigin(article.id, {
      sourceType: "COMPRAMELAFOTO",
      externalEntityType: "ALBUM",
      externalId: 900001,
      operationalPayload: { publicSlug: "test-album", photoCount: 3 },
    });
    if (!again.ok) throw new Error(again.error);
    assert.equal(again.created, false);
    assert.equal(again.origin.id, linkAlbum.origin.id);
    assert.equal((again.origin.operationalPayload as { photoCount?: number })?.photoCount, 3);

    // 4 mismo externalId otra source OK
    const otherSource = await linkArticleToOrigin(article.id, {
      sourceType: "MANUAL",
      externalEntityType: "ALBUM",
      externalId: 900001,
      direction: "OUTBOUND",
    });
    assert.equal(otherSource.ok, true);

    // 5/6 sin target / dual
    const noTarget = await upsertContentOrigin({
      contentType: "ARTICLE",
      sourceType: "API",
      externalEntityType: "UNKNOWN",
      externalId: "x",
    });
    assert.equal(noTarget.ok, false);
    const dual = await upsertContentOrigin({
      contentType: "ARTICLE",
      articleId: article.id,
      eventId: event.id,
      sourceType: "API",
      externalEntityType: "UNKNOWN",
      externalId: "y",
    });
    assert.equal(dual.ok, false);

    // 7/8/9 marks
    const synced = await markOriginSynced(linkAlbum.origin.id, {
      operationalPayload: { publicSlug: "test-album", synced: true },
    });
    assert.equal(synced.syncStatus, "SYNCED");
    assert.equal(synced.syncError, null);

    const failed = await markOriginFailed(linkAlbum.origin.id, "boom");
    assert.equal(failed.syncStatus, "FAILED");
    assert.equal(failed.syncError, "boom");

    const stale = await markOriginStale(linkEvent.origin.id, "album purged");
    assert.equal(stale.syncStatus, "STALE");

    // 10 snapshot updated (ya en upsert again)
    // 11 editorial not altered
    const articleAfter = await prisma.infoSpotArticle.findUnique({ where: { id: article.id } });
    assert.equal(articleAfter?.title, "Origin test article");
    assert.equal(articleAfter?.status, "DRAFT");

    // find by identity
    const found = await findOriginByExternalIdentity(
      { sourceType: "COMPRAMELAFOTO", externalEntityType: "ALBUM", externalId: "900001" },
      { articleId: article.id },
    );
    assert.ok(found);

    // 17 soft refs still presentable (compat: columns exist)
    await prisma.infoSpotArticle.update({
      where: { id: article.id },
      data: { eventId: 1, clfAlbumId: 2 },
    });
    const soft = await prisma.infoSpotArticle.findUnique({
      where: { id: article.id },
      select: { eventId: true, clfAlbumId: true },
    });
    assert.equal(soft?.eventId, 1);
    assert.equal(soft?.clfAlbumId, 2);

    // 18 dry-run no modifica
    const beforeCount = await prisma.infoSpotContentOrigin.count();
    const report = await dryRunBackfillSoftRefsToContentOrigin({ dryRun: true, take: 50 });
    assert.equal(report.dryRun, true);
    const afterCount = await prisma.infoSpotContentOrigin.count();
    assert.equal(afterCount, beforeCount);

    console.log("content-origin persistence tests: ok", {
      wouldCreateEventLinks: report.wouldCreateEventLinks,
      wouldCreateAlbumLinks: report.wouldCreateAlbumLinks,
      articlesScanned: report.articlesScanned,
    });
  } finally {
    await prisma.infoSpotContentOrigin.deleteMany({
      where: { OR: [{ articleId: article.id }, { eventId: event.id }] },
    });
    await prisma.infoSpotArticle.delete({ where: { id: article.id } });
    await prisma.infoSpotEvent.delete({ where: { id: event.id } });
  }
}

await persistence();
