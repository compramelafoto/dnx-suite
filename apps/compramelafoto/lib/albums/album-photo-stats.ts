import type { PrismaClient } from "@/lib/prisma";
import { Prisma } from "@/lib/prisma";

/** Agregados de fotos del álbum para el dashboard (sin cargar el array completo). */
export type AlbumPhotoStats = {
  total: number;
  uncategorized: number;
  earliestCreatedAt: string | null;
  myPhotosCount: number;
  hasOtherContributors: boolean;
};

export type AlbumPhotoStatsRow = {
  userId: number | null;
  createdAt: Date;
  folderId?: number | null;
  eventFolderId?: number | null;
  isRemoved?: boolean;
};

export type EventFolderPhotoCountRow = {
  eventFolderId: number;
  count: number;
};

const activePhotoWhere = (albumId: number) => ({
  albumId,
  isRemoved: false,
});

/**
 * Calcula stats colaborativos a partir de filas (misma lógica que DELETE álbum y listado).
 */
export function computeMyPhotosCount(
  rows: Array<{ userId: number | null }>,
  ownerUserId: number,
  isOwner: boolean
): number {
  if (!isOwner) {
    return rows.filter((p) => p.userId === ownerUserId).length;
  }
  return rows.filter((p) => p.userId === ownerUserId || p.userId == null).length;
}

export function computeHasOtherContributors(
  rows: Array<{ userId: number | null }>,
  ownerUserId: number
): boolean {
  return rows.some((p) => p.userId != null && p.userId !== ownerUserId);
}

export function computeUncategorizedCount(
  rows: Array<{ folderId?: number | null; eventFolderId?: number | null }>,
  mode: "album" | "event"
): number {
  return rows.filter((p) =>
    mode === "event" ? p.eventFolderId == null : p.folderId == null
  ).length;
}

export function computeEarliestCreatedAt(rows: Array<{ createdAt: Date }>): string | null {
  if (rows.length === 0) return null;
  let min = rows[0]!.createdAt.getTime();
  for (let i = 1; i < rows.length; i++) {
    const t = rows[i]!.createdAt.getTime();
    if (t < min) min = t;
  }
  return new Date(min).toISOString();
}

export function buildEventFolderPhotoCounts(
  groups: Array<{ eventFolderId: number | null; _count: { _all: number } }>
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const g of groups) {
    if (typeof g.eventFolderId === "number") {
      out[g.eventFolderId] = g._count._all;
    }
  }
  return out;
}

export function buildAlbumPhotoStatsFromRows(
  rows: AlbumPhotoStatsRow[],
  opts: {
    ownerUserId: number;
    currentUserId: number;
    mode: "album" | "event";
  }
): AlbumPhotoStats {
  const active = rows.filter((p) => p.isRemoved !== true);
  const isOwner = opts.ownerUserId === opts.currentUserId;
  return {
    total: active.length,
    uncategorized: computeUncategorizedCount(active, opts.mode),
    earliestCreatedAt: computeEarliestCreatedAt(active),
    myPhotosCount: computeMyPhotosCount(active, opts.ownerUserId, isOwner),
    hasOtherContributors: computeHasOtherContributors(active, opts.ownerUserId),
  };
}

export async function loadAlbumPhotoStats(
  db: PrismaClient,
  albumId: number,
  ownerUserId: number,
  currentUserId: number,
  mode: "album" | "event"
): Promise<AlbumPhotoStats> {
  const baseWhere = activePhotoWhere(albumId);
  const uncategorizedWhere =
    mode === "event"
      ? { ...baseWhere, eventFolderId: null }
      : { ...baseWhere, folderId: null };

  const [total, uncategorized, earliestRow, myPhotosCount, otherContributorsCount] =
    await Promise.all([
      db.photo.count({ where: baseWhere }),
      db.photo.count({ where: uncategorizedWhere }),
      db.photo.findFirst({
        where: baseWhere,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { createdAt: true },
      }),
      db.photo.count({
        where: {
          ...baseWhere,
          OR: [{ userId: currentUserId }, { userId: null }],
        },
      }),
      db.photo.count({
        where: {
          ...baseWhere,
          userId: { not: null },
          NOT: { userId: ownerUserId },
        },
      }),
    ]);

  return {
    total,
    uncategorized,
    earliestCreatedAt: earliestRow?.createdAt?.toISOString() ?? null,
    myPhotosCount,
    hasOtherContributors: otherContributorsCount > 0,
  };
}

export async function loadEventFolderPhotoCounts(
  db: PrismaClient,
  albumId: number
): Promise<Record<number, number>> {
  const groups = await db.photo.groupBy({
    by: ["eventFolderId"],
    where: {
      ...activePhotoWhere(albumId),
      eventFolderId: { not: null },
    },
    _count: { _all: true },
  });
  return buildEventFolderPhotoCounts(groups);
}

/** Agregados por álbum para listados del dashboard (sin cargar arrays de fotos). */
export type AlbumListPhotoAggregate = {
  photosCount: number;
  myPhotosCount: number;
  hasOtherContributors: boolean;
};

export async function loadAlbumListPhotoAggregates(
  db: PrismaClient,
  albumIds: number[],
  currentUserId: number
): Promise<Map<number, AlbumListPhotoAggregate>> {
  const out = new Map<number, AlbumListPhotoAggregate>();
  if (albumIds.length === 0) return out;

  const rows = await db.$queryRaw<
    Array<{
      albumId: number;
      photosCount: number;
      myPhotosCount: number;
      hasOtherContributors: boolean;
    }>
  >(Prisma.sql`
    SELECT
      "albumId",
      COUNT(*)::int AS "photosCount",
      COUNT(*) FILTER (WHERE "userId" = ${currentUserId} OR "userId" IS NULL)::int AS "myPhotosCount",
      BOOL_OR("userId" IS NOT NULL AND "userId" != ${currentUserId}) AS "hasOtherContributors"
    FROM "Photo"
    WHERE "albumId" IN (${Prisma.join(albumIds)})
      AND "isRemoved" = false
    GROUP BY "albumId"
  `);

  for (const row of rows) {
    out.set(row.albumId, {
      photosCount: row.photosCount,
      myPhotosCount: row.myPhotosCount,
      hasOtherContributors: Boolean(row.hasOtherContributors),
    });
  }
  return out;
}

export async function countActiveAlbumPhotosForAlbum(
  db: PrismaClient,
  albumId: number
): Promise<number> {
  return db.photo.count({ where: activePhotoWhere(albumId) });
}
