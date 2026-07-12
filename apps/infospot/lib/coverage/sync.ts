/**
 * Sync idempotente: álbum CLF público → InfoSpotCoverage.
 */

import { prisma, type Prisma } from "@repo/db";
import { buildAiPrepContract } from "./ai-stub";
import { resolveCoverageCommercial, shouldHidePurchaseCta } from "./commercial";
import { buildCreditsPrep } from "./credits-stub";
import { deriveCoverageEditorialStatus } from "./editorial-status";
import { mergeCoveragePhotographers } from "./photographers";
import { buildPhotoSelectorPrep } from "./photo-selector-stub";
import type { CoverageAlbumSnapshot, CoverageSyncResult } from "./types";

function priorityScore(album: CoverageAlbumSnapshot, commercialStatus: string): number {
  let score = 0;
  score += Math.min(40, album.photoCount);
  score += Math.min(20, album.photographers.length * 5);
  if (commercialStatus === "AVAILABLE") score += 25;
  if (album.clfEventId) score += 10;
  if (album.city) score += 5;
  return score;
}

function operationalSnapshot(
  album: CoverageAlbumSnapshot,
  commercial: ReturnType<typeof resolveCoverageCommercial>,
): Prisma.InputJsonValue {
  return {
    clfAlbumId: album.clfAlbumId,
    publicSlug: album.publicSlug,
    title: album.title,
    clfEventId: album.clfEventId,
    eventTitle: album.eventTitle,
    city: album.city,
    isPublic: album.isPublic,
    isHidden: album.isHidden,
    deletedAt: album.deletedAt?.toISOString() ?? null,
    firstPhotoDate: album.firstPhotoDate?.toISOString() ?? null,
    createdAt: album.createdAt.toISOString(),
    expirationExtensionDays: album.expirationExtensionDays,
    cleanupStatus: album.cleanupStatus,
    photoCount: album.photoCount,
    commercialStatus: commercial.status,
    publicUrl: commercial.publicUrl,
    photographers: album.photographers,
  };
}

/**
 * Upsert de una cobertura desde snapshot ya normalizado (tests + sync batch).
 */
export async function upsertCoverageFromAlbumSnapshot(
  album: CoverageAlbumSnapshot,
): Promise<CoverageSyncResult> {
  const photographers = mergeCoveragePhotographers(album.photographers);
  const commercial = resolveCoverageCommercial(album);
  const hideCta = shouldHidePurchaseCta(commercial) || album.isHidden || Boolean(album.deletedAt);

  const existing = await prisma.infoSpotCoverage.findUnique({
    where: { clfAlbumId: album.clfAlbumId },
    include: {
      articles: { include: { article: { select: { status: true } } } },
    },
  });

  const isDeletedOrGone = Boolean(album.deletedAt) || (!album.isPublic && album.isHidden === false);
  const syncStatus = isDeletedOrGone || commercial.status === "UNAVAILABLE"
    ? "STALE"
    : "SYNCED";

  let discoveryStatus = existing?.discoveryStatus ?? "DISCOVERED";
  if (existing?.discoveryStatus === "DISMISSED") {
    discoveryStatus = "DISMISSED";
  } else if ((existing?.articles.length ?? 0) > 0 || discoveryStatus === "LINKED") {
    discoveryStatus = "LINKED";
  }

  const editorialStatus = deriveCoverageEditorialStatus({
    syncStatus,
    discoveryStatus,
    articles: (existing?.articles ?? []).map((l) => ({ status: l.article.status })),
  });

  const ai = buildAiPrepContract({
    photoCount: album.photoCount,
    photographerCount: photographers.length,
    commercialStatus: commercial.status,
    syncStatus,
    currentStatus: existing?.aiPrepStatus,
  });
  const selector = buildPhotoSelectorPrep({
    clfAlbumId: album.clfAlbumId,
    photoCount: album.photoCount,
    syncStatus,
    commercialStatus: commercial.status,
    currentStatus: existing?.photoSelectorStatus,
  });
  const credits = buildCreditsPrep({
    photographers,
    syncStatus,
  });

  const data = {
    title: album.title,
    publicSlug: album.publicSlug,
    publicUrl: hideCta ? null : commercial.publicUrl,
    coverThumbnailUrl: album.coverThumbnailKey
      ? null // keys no se exponen; UI usa proxy de thumbs
      : null,
    city: album.city,
    eventTitle: album.eventTitle,
    clfEventId: album.clfEventId,
    photoCount: album.photoCount,
    discoveryStatus: discoveryStatus as "DISCOVERED" | "QUEUED" | "DISMISSED" | "LINKED",
    editorialStatus,
    syncStatus: syncStatus as "PENDING" | "SYNCED" | "FAILED" | "STALE" | "DISABLED",
    commercialStatus: commercial.status,
    commercialReason: commercial.reason,
    canShowPurchaseCta: !hideCta && commercial.canShowPurchaseCta,
    operationalSnapshot: operationalSnapshot(album, commercial),
    priorityScore: priorityScore({ ...album, photographers }, commercial.status),
    lastSyncedAt: new Date(),
    lastSyncError: null,
    aiPrepStatus: ai.status,
    photoSelectorStatus: selector.status,
    creditsStatus: credits.status,
    aiPrepMeta: {
      canEnqueue: ai.canEnqueue,
      reasons: ai.reasons,
      suggestedActions: ai.suggestedActions,
    } satisfies Prisma.InputJsonValue,
    photoSelectorMeta: {
      canOpenSelector: selector.canOpenSelector,
      endpointHint: selector.endpointHint,
      reasons: selector.reasons,
    } satisfies Prisma.InputJsonValue,
    creditsMeta: {
      canAutoCredit: credits.canAutoCredit,
      credits: credits.credits,
      reasons: credits.reasons,
    } satisfies Prisma.InputJsonValue,
  };

  const coverage = existing
    ? await prisma.infoSpotCoverage.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.infoSpotCoverage.create({
        data: {
          clfAlbumId: album.clfAlbumId,
          ...data,
        },
      });

  // Reemplazo idempotente de fotógrafos
  await prisma.infoSpotCoveragePhotographer.deleteMany({
    where: { coverageId: coverage.id },
  });
  if (photographers.length > 0) {
    await prisma.infoSpotCoveragePhotographer.createMany({
      data: photographers.map((p) => ({
        coverageId: coverage.id,
        clfUserId: p.clfUserId,
        displayName: p.displayName,
        role: p.role,
        photoCount: p.photoCount,
        creditHint: credits.credits.find((c) => c.clfUserId === p.clfUserId)?.creditLine ?? null,
      })),
    });
  }

  return {
    coverageId: coverage.id,
    clfAlbumId: album.clfAlbumId,
    created: !existing,
    updated: Boolean(existing),
    commercialStatus: commercial.status,
    canShowPurchaseCta: coverage.canShowPurchaseCta,
    photographerCount: photographers.length,
  };
}

/** Marca cobertura STALE cuando el álbum desaparece del feed público. */
export async function markCoverageStaleFromMissingAlbum(
  clfAlbumId: number,
  reason: string,
): Promise<void> {
  const existing = await prisma.infoSpotCoverage.findUnique({
    where: { clfAlbumId },
    include: {
      articles: { include: { article: { select: { status: true } } } },
    },
  });
  if (!existing) return;

  const editorialStatus = deriveCoverageEditorialStatus({
    syncStatus: "STALE",
    discoveryStatus: existing.discoveryStatus,
    articles: existing.articles.map((l) => ({ status: l.article.status })),
  });

  await prisma.infoSpotCoverage.update({
    where: { id: existing.id },
    data: {
      syncStatus: "STALE",
      editorialStatus,
      canShowPurchaseCta: false,
      commercialStatus: "UNAVAILABLE",
      commercialReason: reason,
      publicUrl: null,
      lastSyncedAt: new Date(),
      lastSyncError: reason,
    },
  });
}
