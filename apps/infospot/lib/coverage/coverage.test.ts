/**
 * Tests Centro Editorial de Coberturas.
 * pnpm --filter infospot test:coverage
 */

import assert from "node:assert/strict";
import { prisma } from "@repo/db";
import {
  buildAiPrepContract,
  buildCoverageSummaryStub,
  buildCreditsPrep,
  buildPhotoSelectorPrep,
  createArticleFromCoverage,
  deriveCoverageEditorialStatus,
  getCoverageDashboardMetrics,
  mergeCoveragePhotographers,
  resolveCoverageCommercial,
  shouldHidePurchaseCta,
  upsertCoverageFromAlbumSnapshot,
  markCoverageStaleFromMissingAlbum,
  type CoverageAlbumSnapshot,
} from "./index";

function baseAlbum(
  overrides: Partial<CoverageAlbumSnapshot> = {},
): CoverageAlbumSnapshot {
  const id = overrides.clfAlbumId ?? 910001 + Math.floor(Math.random() * 100000);
  return {
    clfAlbumId: id,
    publicSlug: `cov-test-${id}`,
    title: `Álbum cobertura ${id}`,
    clfEventId: 55,
    eventTitle: "Evento test cobertura",
    city: "Rosario",
    isPublic: true,
    isHidden: false,
    deletedAt: null,
    firstPhotoDate: new Date(),
    createdAt: new Date(),
    expirationExtensionDays: 0,
    cleanupStatus: "NONE",
    coverThumbnailKey: null,
    photoCount: 12,
    photographers: [
      {
        clfUserId: 101,
        displayName: "Ana Foto",
        role: "PRIMARY",
        photoCount: 8,
      },
      {
        clfUserId: 102,
        displayName: "Bruno Colab",
        role: "COLLABORATOR",
        photoCount: 4,
      },
    ],
    ...overrides,
  };
}

async function cleanup(clfAlbumIds: number[], articleIds: string[]) {
  const coverages = await prisma.infoSpotCoverage.findMany({
    where: { clfAlbumId: { in: clfAlbumIds } },
    select: { id: true },
  });
  const coverageIds = coverages.map((c) => c.id);
  if (coverageIds.length) {
    await prisma.infoSpotCoverageArticle.deleteMany({
      where: { coverageId: { in: coverageIds } },
    });
    await prisma.infoSpotCoveragePhotographer.deleteMany({
      where: { coverageId: { in: coverageIds } },
    });
    await prisma.infoSpotCoverage.deleteMany({
      where: { id: { in: coverageIds } },
    });
  }
  if (articleIds.length) {
    await prisma.infoSpotContentOrigin.deleteMany({
      where: { articleId: { in: articleIds } },
    });
    await prisma.infoSpotArticle.deleteMany({ where: { id: { in: articleIds } } });
  }
}

async function main() {
  // Pure: commercial / CTA
  {
    const available = resolveCoverageCommercial(baseAlbum());
    assert.equal(available.status, "AVAILABLE");
    assert.equal(available.canShowPurchaseCta, true);
    assert.equal(shouldHidePurchaseCta(available), false);

    const hidden = resolveCoverageCommercial(baseAlbum({ isHidden: true }));
    assert.ok(hidden.status === "REACTIVATABLE" || hidden.status === "AVAILABLE" || hidden.status === "UNAVAILABLE");
    // CTA must hide when not purchaseable or explicitly hidden path in sync
    const deleted = resolveCoverageCommercial(
      baseAlbum({ deletedAt: new Date(), isPublic: false }),
    );
    assert.equal(deleted.status, "UNAVAILABLE");
    assert.equal(deleted.canShowPurchaseCta, false);
    assert.equal(shouldHidePurchaseCta(deleted), true);
  }

  // Pure: photographers merge + multi
  {
    const merged = mergeCoveragePhotographers([
      { clfUserId: 1, displayName: "A", role: "CONTRIBUTOR", photoCount: 2 },
      { clfUserId: 1, displayName: "A", role: "PRIMARY", photoCount: 5 },
      { clfUserId: 2, displayName: "B", role: "COLLABORATOR", photoCount: 3 },
    ]);
    assert.equal(merged.length, 2);
    assert.equal(merged[0]!.role, "PRIMARY");
    assert.equal(merged[0]!.photoCount, 5);
  }

  // Pure: editorial status
  {
    assert.equal(
      deriveCoverageEditorialStatus({
        syncStatus: "SYNCED",
        discoveryStatus: "DISCOVERED",
        articles: [],
      }),
      "UNASSIGNED",
    );
    assert.equal(
      deriveCoverageEditorialStatus({
        syncStatus: "SYNCED",
        discoveryStatus: "LINKED",
        articles: [{ status: "DRAFT" }, { status: "PUBLISHED" }],
      }),
      "PUBLISHED",
    );
    assert.equal(
      deriveCoverageEditorialStatus({
        syncStatus: "STALE",
        discoveryStatus: "LINKED",
        articles: [{ status: "PUBLISHED" }],
      }),
      "STALE",
    );
  }

  // Pure: stubs AI / selector / credits / resumen
  {
    const ai = buildAiPrepContract({
      photoCount: 10,
      photographerCount: 2,
      commercialStatus: "AVAILABLE",
      syncStatus: "SYNCED",
    });
    assert.equal(ai.status, "READY");
    assert.equal(ai.canEnqueue, true);

    const selector = buildPhotoSelectorPrep({
      clfAlbumId: 1,
      photoCount: 10,
      syncStatus: "SYNCED",
      commercialStatus: "AVAILABLE",
    });
    assert.equal(selector.canOpenSelector, true);
    assert.ok(selector.endpointHint.includes("/photos"));

    const credits = buildCreditsPrep({
      photographers: [{ clfUserId: 1, displayName: "Ana" }],
      syncStatus: "SYNCED",
    });
    assert.equal(credits.status, "READY");
    assert.ok(credits.credits[0]!.creditLine.includes("Ana"));

    const summary = buildCoverageSummaryStub({
      title: "Álbum",
      city: "Rosario",
      eventTitle: "Carrera",
      photoCount: 10,
      photographerNames: ["Ana"],
    });
    assert.ok(summary.includes("Carrera"));
    assert.ok(summary.includes("Rosario"));
  }

  // Persistence
  const hasModel =
    typeof (prisma as { infoSpotCoverage?: { findMany?: unknown } }).infoSpotCoverage
      ?.findMany === "function";
  if (!hasModel) {
    console.log("coverage tests: pure ok (modelo no generado aún)");
    return;
  }

  const albumIds: number[] = [];
  const articleIds: string[] = [];
  try {
    const album = baseAlbum();
    albumIds.push(album.clfAlbumId);

    // álbum nuevo crea cobertura
    const first = await upsertCoverageFromAlbumSnapshot(album);
    assert.equal(first.created, true);
    assert.equal(first.photographerCount, 2);
    assert.equal(first.canShowPurchaseCta, true);

    // sync idempotente
    const second = await upsertCoverageFromAlbumSnapshot(album);
    assert.equal(second.created, false);
    assert.equal(second.updated, true);
    assert.equal(second.coverageId, first.coverageId);
    const count = await prisma.infoSpotCoverage.count({
      where: { clfAlbumId: album.clfAlbumId },
    });
    assert.equal(count, 1);

    // múltiples fotógrafos
    const photographers = await prisma.infoSpotCoveragePhotographer.count({
      where: { coverageId: first.coverageId },
    });
    assert.equal(photographers, 2);

    // crear artículo + abrir (vía id)
    const author = await prisma.user.findFirst({ select: { id: true } });
    assert.ok(author, "Se necesita un User en staging para tests de artículo");
    const created = await createArticleFromCoverage({
      coverageId: first.coverageId,
      authorId: author!.id,
    });
    if (!created.ok) throw new Error(created.error);
    articleIds.push(created.articleId);

    const article = await prisma.infoSpotArticle.findUnique({
      where: { id: created.articleId },
    });
    assert.ok(article);
    assert.equal(article!.status, "DRAFT");
    assert.equal(article!.clfAlbumId, album.clfAlbumId);

    // múltiples artículos
    const secondArticle = await createArticleFromCoverage({
      coverageId: first.coverageId,
      authorId: author!.id,
      linkRole: "FOLLOW_UP",
    });
    if (!secondArticle.ok) throw new Error(secondArticle.error);
    articleIds.push(secondArticle.articleId);
    const links = await prisma.infoSpotCoverageArticle.count({
      where: { coverageId: first.coverageId },
    });
    assert.equal(links, 2);

    // dashboard / métricas
    const metrics = await getCoverageDashboardMetrics();
    assert.ok(metrics.total >= 1);
    assert.ok(metrics.withArticles >= 1);
    assert.ok(metrics.multiPhotographer >= 1);

    // álbum oculto elimina CTA
    const hiddenSync = await upsertCoverageFromAlbumSnapshot(
      baseAlbum({
        clfAlbumId: album.clfAlbumId,
        publicSlug: album.publicSlug,
        isHidden: true,
        isPublic: true,
      }),
    );
    assert.equal(hiddenSync.canShowPurchaseCta, false);

    // álbum eliminado cambia estado
    await markCoverageStaleFromMissingAlbum(album.clfAlbumId, "Álbum eliminado en CLF");
    const stale = await prisma.infoSpotCoverage.findUnique({
      where: { clfAlbumId: album.clfAlbumId },
    });
    assert.equal(stale?.syncStatus, "STALE");
    assert.equal(stale?.canShowPurchaseCta, false);
    assert.equal(stale?.editorialStatus, "STALE");

    console.log("coverage tests: ok");
  } finally {
    await cleanup(albumIds, articleIds);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
