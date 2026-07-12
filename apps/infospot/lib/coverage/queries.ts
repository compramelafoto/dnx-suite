/**
 * Queries del Centro de Coberturas + métricas dashboard.
 */

import { prisma } from "@repo/db";
import type { CoverageDashboardMetrics } from "./types";
import {
  listPublicClfAlbumsForCoverage,
  getClfAlbumSnapshotById,
} from "./clf-albums";
import {
  markCoverageStaleFromMissingAlbum,
  upsertCoverageFromAlbumSnapshot,
} from "./sync";

export async function syncPublicCoveragesFromClf(options?: {
  take?: number;
}): Promise<{
  ok: boolean;
  error?: string;
  created: number;
  updated: number;
  staleMarked: number;
  totalSeen: number;
}> {
  const listed = await listPublicClfAlbumsForCoverage({ take: options?.take ?? 100 });
  if (!listed.ok) {
    return {
      ok: false,
      error: listed.error,
      created: 0,
      updated: 0,
      staleMarked: 0,
      totalSeen: 0,
    };
  }

  let created = 0;
  let updated = 0;
  const seenIds = new Set<number>();

  for (const album of listed.albums) {
    seenIds.add(album.clfAlbumId);
    const result = await upsertCoverageFromAlbumSnapshot(album);
    if (result.created) created += 1;
    if (result.updated) updated += 1;
  }

  // Álbumes previamente conocidos que ya no están en el feed público
  const known = await prisma.infoSpotCoverage.findMany({
    where: {
      syncStatus: { not: "DISABLED" },
      discoveryStatus: { not: "DISMISSED" },
    },
    select: { clfAlbumId: true },
    take: 500,
  });

  let staleMarked = 0;
  for (const row of known) {
    if (seenIds.has(row.clfAlbumId)) continue;
    const snap = await getClfAlbumSnapshotById(row.clfAlbumId);
    if (!snap || snap.deletedAt || !snap.isPublic || snap.isHidden) {
      await markCoverageStaleFromMissingAlbum(
        row.clfAlbumId,
        snap?.deletedAt
          ? "Álbum eliminado en CLF"
          : snap?.isHidden
            ? "Álbum oculto en CLF"
            : "Álbum ya no es público o no aparece en el feed",
      );
      staleMarked += 1;
      continue;
    }
    await upsertCoverageFromAlbumSnapshot(snap);
  }

  return {
    ok: true,
    created,
    updated,
    staleMarked,
    totalSeen: listed.albums.length,
  };
}

export async function listCoveragesForCenter(options?: {
  take?: number;
  includeDismissed?: boolean;
}) {
  const take = options?.take ?? 60;
  return prisma.infoSpotCoverage.findMany({
    where: options?.includeDismissed
      ? undefined
      : { discoveryStatus: { not: "DISMISSED" } },
    orderBy: [{ priorityScore: "desc" }, { lastSyncedAt: "desc" }, { updatedAt: "desc" }],
    take,
    include: {
      photographers: { orderBy: { photoCount: "desc" } },
      articles: {
        include: {
          article: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              contentTag: true,
            },
          },
        },
      },
    },
  });
}

export async function getCoverageById(id: string) {
  return prisma.infoSpotCoverage.findUnique({
    where: { id },
    include: {
      photographers: { orderBy: [{ role: "asc" }, { photoCount: "desc" }] },
      articles: {
        include: {
          article: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              contentTag: true,
              publishedAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { linkedAt: "desc" },
      },
      assignedTo: { select: { id: true, name: true, email: true } },
      editorialPhotos: {
        orderBy: { updatedAt: "desc" },
        take: 40,
        include: {
          variants: { where: { format: "webp", width: 640 }, take: 1 },
          usages: {
            include: {
              article: { select: { id: true, title: true, status: true } },
            },
          },
        },
      },
    },
  });
}

export async function getCoverageDashboardMetrics(): Promise<CoverageDashboardMetrics> {
  const [
    total,
    discovered,
    linked,
    dismissed,
    stale,
    availableCommercial,
    withArticles,
    multiPhotographer,
    aiReady,
    selectorReady,
    creditsReady,
  ] = await Promise.all([
    prisma.infoSpotCoverage.count(),
    prisma.infoSpotCoverage.count({ where: { discoveryStatus: "DISCOVERED" } }),
    prisma.infoSpotCoverage.count({ where: { discoveryStatus: "LINKED" } }),
    prisma.infoSpotCoverage.count({ where: { discoveryStatus: "DISMISSED" } }),
    prisma.infoSpotCoverage.count({ where: { syncStatus: "STALE" } }),
    prisma.infoSpotCoverage.count({ where: { commercialStatus: "AVAILABLE" } }),
    prisma.infoSpotCoverage.count({ where: { articles: { some: {} } } }),
    prisma.infoSpotCoverage.count({
      where: { photographers: { some: {} } },
    }).then(async () => {
      const rows = await prisma.infoSpotCoverage.findMany({
        select: { id: true, _count: { select: { photographers: true } } },
        take: 500,
      });
      return rows.filter((r) => r._count.photographers > 1).length;
    }),
    prisma.infoSpotCoverage.count({ where: { aiPrepStatus: "READY" } }),
    prisma.infoSpotCoverage.count({ where: { photoSelectorStatus: "READY" } }),
    prisma.infoSpotCoverage.count({ where: { creditsStatus: "READY" } }),
  ]);

  return {
    total,
    discovered,
    linked,
    dismissed,
    stale,
    availableCommercial,
    withArticles,
    multiPhotographer,
    aiReady,
    selectorReady,
    creditsReady,
  };
}
