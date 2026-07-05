import type {
  PhotographerDeviceType,
  PhotographicGearConfidence,
  PhotoExifMetadataStatus,
} from "@/lib/prisma";
import { Prisma } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import {
  getExifDeviceScanBackfillBatchSize,
  getExifDeviceScanBatchSize,
  getExifDeviceScanDailyBatchSize,
  getExifDeviceScanTimezone,
  isExifDeviceScanBackfillEnabled,
  isExifDeviceScanEnabled,
  isWithinExifDeviceScanWindow,
} from "@/lib/photographic-equipment/config";
import { formatGearLabel, formatEquipmentDisplayLabel } from "@/lib/photographic-equipment/gear-normalize";
import { pendingExifPhotoWhere } from "@/lib/photographic-equipment/pending-photos";
import { getExifDeviceScanLease } from "@/lib/photographic-equipment/scan-lease";
import { getExifDeviceScanStateSnapshot } from "@/lib/photographic-equipment/scan-state";

const ACTIVE_GEAR = { status: "ACTIVE" as const };

export type PhotographicEquipmentSummary = {
  generatedAt: string;
  gear: {
    uniqueBodies: number;
    uniqueLenses: number;
    combinations: number;
    physicalEquipment: number;
    bodiesWithShutterCount: number;
    legacyDevices: number;
  };
  photos: {
    analyzed: number;
    observations: number;
    pending: number;
    noExif: number;
    failed: number;
    skippedExpired: number;
  };
  scan: {
    enabled: boolean;
    backfillEnabled: boolean;
    inWindow: boolean;
    timezone: string;
    batchSize: number;
    backfillBatchSize: number;
    dailyBatchSize: number;
    mode: "BACKFILL" | "DAILY";
    isBackfillComplete: boolean;
    lastRunAt: string | null;
    lastCompletedAt: string | null;
    lastBatchAt: string | null;
    lastBatchProcessed: number;
    lastBatchAnalyzed: number;
    processedTotal: number;
    analyzedTotal: number;
    noExifTotal: number;
    failedTotal: number;
  };
};

export type PhotographicEquipmentPhotographerListItem = {
  photographer: {
    id: number;
    email: string;
    name: string | null;
    handler: string | null;
  };
  bodiesCount: number;
  lensesCount: number;
  combinationsCount: number;
  observationsCount: number;
  lastSeenAt: string | null;
};

export type PhotographicEquipmentBodyLensUsage = {
  lensId: number | null;
  lensLabel: string;
  photosCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type PhotographicEquipmentCombinationItem = {
  id: number;
  bodyLabel: string;
  lensLabel: string | null;
  photosCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  albumTitles: string[];
};

export type PhotographicEquipmentBodyCard = {
  id: number;
  makeRaw: string;
  modelRaw: string;
  make: string;
  model: string;
  label: string;
  serialNumber: string | null;
  deviceType: PhotographerDeviceType;
  confidence: PhotographicGearConfidence;
  photosCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  maxShutterCount: number | null;
  maxShutterCountTakenAt: string | null;
  maxShutterCountUploadedAt: string | null;
  maxShutterCountSourceField: string | null;
  maxShutterCountConfidence: string | null;
  maxShutterCountAlbum: { id: number; title: string } | null;
  maxShutterCountPhoto: { id: number; albumId: number } | null;
  lensesUsed: PhotographicEquipmentBodyLensUsage[];
};

export type PhotographicEquipmentPhotographerDetail = {
  photographer: {
    id: number;
    email: string;
    name: string | null;
    handler: string | null;
  };
  totals: {
    bodies: number;
    lenses: number;
    combinations: number;
    observations: number;
  };
  bodies: PhotographicEquipmentBodyCard[];
  combinations: PhotographicEquipmentCombinationItem[];
};

export type PhotographicEquipmentJobStatus = {
  generatedAt: string;
  enabled: boolean;
  backfillEnabled: boolean;
  inWindow: boolean;
  timezone: string;
  batchSize: number;
  backfillBatchSize: number;
  dailyBatchSize: number;
  mode: "BACKFILL" | "DAILY";
  isBackfillComplete: boolean;
  pendingPhotos: number;
  lastRunAt: string | null;
  lastCompletedAt: string | null;
  lastBatchAt: string | null;
  lastBatchProcessed: number;
  lastBatchAnalyzed: number;
  processedTotal: number;
  analyzedTotal: number;
  noExifTotal: number;
  failedTotal: number;
  lastAnalyzedAt: string | null;
  recentFailures: number;
  lease: {
    isLocked: boolean;
    holder: string | null;
    lockedAt: string | null;
    expiresAt: string | null;
    isStale: boolean;
  };
};

export async function getPhotographicEquipmentSummary(): Promise<PhotographicEquipmentSummary> {
  const [
    uniqueBodies,
    uniqueLenses,
    combinations,
    observations,
    bodiesWithShutterCount,
    legacyDevices,
    analyzedCount,
    pendingCount,
    noExifCount,
    failedCount,
    skippedExpiredCount,
    scanState,
  ] = await Promise.all([
    prisma.photographicCameraBody.count({ where: ACTIVE_GEAR }),
    prisma.photographicLens.count({ where: ACTIVE_GEAR }),
    prisma.photographicGearCombination.count(),
    prisma.photographicGearObservation.count(),
    prisma.photographicCameraBody.count({
      where: { ...ACTIVE_GEAR, maxShutterCount: { not: null } },
    }),
    prisma.photographerDevice.count(),
    prisma.photo.count({ where: { exifMetadataStatus: "ANALYZED", isRemoved: false } }),
    prisma.photo.count({ where: pendingExifPhotoWhere }),
    prisma.photo.count({ where: { exifMetadataStatus: "NO_EXIF", isRemoved: false } }),
    prisma.photo.count({ where: { exifMetadataStatus: "FAILED", isRemoved: false } }),
    prisma.photo.count({ where: { exifMetadataStatus: "SKIPPED_EXPIRED", isRemoved: false } }),
    getExifDeviceScanStateSnapshot(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    gear: {
      uniqueBodies,
      uniqueLenses,
      combinations,
      physicalEquipment: uniqueBodies + uniqueLenses,
      bodiesWithShutterCount,
      legacyDevices,
    },
    photos: {
      analyzed: analyzedCount,
      observations,
      pending: pendingCount,
      noExif: noExifCount,
      failed: failedCount,
      skippedExpired: skippedExpiredCount,
    },
    scan: {
      enabled: isExifDeviceScanEnabled(),
      backfillEnabled: isExifDeviceScanBackfillEnabled(),
      inWindow: isWithinExifDeviceScanWindow(),
      timezone: getExifDeviceScanTimezone(),
      batchSize: getExifDeviceScanBatchSize(),
      backfillBatchSize: getExifDeviceScanBackfillBatchSize(),
      dailyBatchSize: getExifDeviceScanDailyBatchSize(),
      mode: scanState.mode,
      isBackfillComplete: scanState.isBackfillComplete,
      lastRunAt: scanState.lastRunAt,
      lastCompletedAt: scanState.lastCompletedAt,
      lastBatchAt: scanState.lastBatchAt,
      lastBatchProcessed: scanState.lastBatchProcessed,
      lastBatchAnalyzed: scanState.lastBatchAnalyzed,
      processedTotal: scanState.processedTotal,
      analyzedTotal: scanState.analyzedTotal,
      noExifTotal: scanState.noExifTotal,
      failedTotal: scanState.failedTotal,
    },
  };
}

export type ListPhotographersFilters = {
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function listPhotographicEquipmentPhotographers(
  filters: ListPhotographersFilters = {}
): Promise<{
  photographers: PhotographicEquipmentPhotographerListItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20));
  const skip = (page - 1) * pageSize;
  const search = filters.search?.trim();

  const searchClause = search
    ? Prisma.sql`AND (
        u.email ILIKE ${`%${search}%`}
        OR u.name ILIKE ${`%${search}%`}
        OR u.handler ILIKE ${`%${search}%`}
      )`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{
      photographerId: number;
      email: string;
      name: string | null;
      handler: string | null;
      bodiesCount: bigint;
      lensesCount: bigint;
      combinationsCount: bigint;
      observationsCount: bigint;
      lastSeenAt: Date | null;
    }>
  >`
    SELECT u.id AS "photographerId",
           u.email,
           u.name,
           u.handler,
           COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'ACTIVE')::bigint AS "bodiesCount",
           COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'ACTIVE')::bigint AS "lensesCount",
           COUNT(DISTINCT c.id)::bigint AS "combinationsCount",
           COUNT(DISTINCT o.id)::bigint AS "observationsCount",
           MAX(GREATEST(b."lastSeenAt", l."lastSeenAt", o."takenAt")) AS "lastSeenAt"
    FROM "User" u
    LEFT JOIN "PhotographicCameraBody" b ON b."photographerId" = u.id
    LEFT JOIN "PhotographicLens" l ON l."photographerId" = u.id
    LEFT JOIN "PhotographicGearCombination" c ON c."photographerId" = u.id
    LEFT JOIN "PhotographicGearObservation" o ON o."photographerId" = u.id
    WHERE (
      b.id IS NOT NULL OR l.id IS NOT NULL OR o.id IS NOT NULL
    )
    ${searchClause}
    GROUP BY u.id, u.email, u.name, u.handler
    HAVING COUNT(DISTINCT b.id) > 0 OR COUNT(DISTINCT o.id) > 0
    ORDER BY MAX(GREATEST(b."lastSeenAt", l."lastSeenAt", o."takenAt")) DESC NULLS LAST
    LIMIT ${pageSize} OFFSET ${skip}
  `;

  const countRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
    SELECT COUNT(*)::bigint AS total FROM (
      SELECT u.id
      FROM "User" u
      LEFT JOIN "PhotographicCameraBody" b ON b."photographerId" = u.id
      LEFT JOIN "PhotographicGearObservation" o ON o."photographerId" = u.id
      WHERE b.id IS NOT NULL OR o.id IS NOT NULL
      ${searchClause}
      GROUP BY u.id
      HAVING COUNT(DISTINCT b.id) > 0 OR COUNT(DISTINCT o.id) > 0
    ) sub
  `;

  const total = Number(countRows[0]?.total ?? 0);

  const photographers: PhotographicEquipmentPhotographerListItem[] = rows.map((row) => ({
    photographer: {
      id: row.photographerId,
      email: row.email,
      name: row.name,
      handler: row.handler,
    },
    bodiesCount: Number(row.bodiesCount),
    lensesCount: Number(row.lensesCount),
    combinationsCount: Number(row.combinationsCount),
    observationsCount: Number(row.observationsCount),
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
  }));

  return {
    photographers,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getPhotographicEquipmentPhotographerDetail(
  photographerId: number
): Promise<PhotographicEquipmentPhotographerDetail | null> {
  const photographer = await prisma.user.findUnique({
    where: { id: photographerId },
    select: { id: true, email: true, name: true, handler: true },
  });
  if (!photographer) return null;

  const bodies = await prisma.photographicCameraBody.findMany({
    where: { photographerId, ...ACTIVE_GEAR },
    orderBy: { lastSeenAt: "desc" },
  });

  const bodyIds = bodies.map((b) => b.id);

  const [lenses, combinations, observationsCount, maxShutterAlbums, maxShutterPhotos] =
    await Promise.all([
      prisma.photographicLens.findMany({
        where: { photographerId, ...ACTIVE_GEAR },
        orderBy: { lastSeenAt: "desc" },
      }),
      prisma.photographicGearCombination.findMany({
        where: { photographerId },
        include: {
          cameraBody: { select: { makeRaw: true, modelRaw: true, make: true, model: true } },
          lens: { select: { makeRaw: true, modelRaw: true, make: true, model: true } },
        },
        orderBy: { lastSeenAt: "desc" },
      }),
      prisma.photographicGearObservation.count({ where: { photographerId } }),
      bodyIds.length > 0
        ? prisma.album.findMany({
            where: {
              id: {
                in: bodies
                  .map((b) => b.maxShutterCountAlbumId)
                  .filter((id): id is number => id != null),
              },
            },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      bodyIds.length > 0
        ? prisma.photo.findMany({
            where: {
              id: {
                in: bodies
                  .map((b) => b.maxShutterCountPhotoId)
                  .filter((id): id is number => id != null),
              },
            },
            select: { id: true, albumId: true, createdAt: true },
          })
        : Promise.resolve([]),
    ]);

  const albumTitleById = new Map(maxShutterAlbums.map((a) => [a.id, a.title]));
  const photoById = new Map(maxShutterPhotos.map((p) => [p.id, p]));

  const lensUsageByBody = new Map<number, PhotographicEquipmentBodyLensUsage[]>();

  if (bodyIds.length > 0) {
    const lensUsageRows = await prisma.$queryRaw<
      Array<{
        cameraBodyId: number;
        lensId: number | null;
        lensMakeRaw: string | null;
        lensModelRaw: string | null;
        lensMake: string | null;
        lensModel: string | null;
        photosCount: bigint;
        firstSeenAt: Date;
        lastSeenAt: Date;
      }>
    >`
      SELECT o."cameraBodyId",
             o."lensId",
             l."makeRaw" AS "lensMakeRaw",
             l."modelRaw" AS "lensModelRaw",
             l.make AS "lensMake",
             l.model AS "lensModel",
             COUNT(*)::bigint AS "photosCount",
             MIN(COALESCE(o."takenAt", o."uploadedAt")) AS "firstSeenAt",
             MAX(COALESCE(o."takenAt", o."uploadedAt")) AS "lastSeenAt"
      FROM "PhotographicGearObservation" o
      LEFT JOIN "PhotographicLens" l ON l.id = o."lensId"
      WHERE o."photographerId" = ${photographerId}
        AND o."cameraBodyId" IN (${Prisma.join(bodyIds)})
      GROUP BY o."cameraBodyId", o."lensId", l."makeRaw", l."modelRaw", l.make, l.model
      ORDER BY MAX(COALESCE(o."takenAt", o."uploadedAt")) DESC
    `;

    for (const row of lensUsageRows) {
      const list = lensUsageByBody.get(row.cameraBodyId) ?? [];
      const lensLabel = row.lensId
        ? row.lensMakeRaw && row.lensModelRaw
          ? `${row.lensMakeRaw} ${row.lensModelRaw}`.trim()
          : formatGearLabel(row.lensMake ?? "desconocido", row.lensModel ?? "desconocido")
        : "Sin lente en EXIF";
      list.push({
        lensId: row.lensId,
        lensLabel,
        photosCount: Number(row.photosCount),
        firstSeenAt: row.firstSeenAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
      });
      lensUsageByBody.set(row.cameraBodyId, list);
    }
  }

  const combinationAlbums = await prisma.$queryRaw<
    Array<{ combinationId: number; albumTitle: string }>
  >`
    SELECT o."combinationId",
           a.title AS "albumTitle"
    FROM "PhotographicGearObservation" o
    INNER JOIN "Album" a ON a.id = o."albumId"
    WHERE o."photographerId" = ${photographerId}
      AND o."combinationId" IS NOT NULL
    GROUP BY o."combinationId", a.title
    ORDER BY a.title
  `;

  const albumsByCombination = new Map<number, string[]>();
  for (const row of combinationAlbums) {
    if (row.combinationId == null) continue;
    const list = albumsByCombination.get(row.combinationId) ?? [];
    list.push(row.albumTitle);
    albumsByCombination.set(row.combinationId, list);
  }

  const bodyCards: PhotographicEquipmentBodyCard[] = bodies.map((body) => {
    const maxPhoto = body.maxShutterCountPhotoId
      ? photoById.get(body.maxShutterCountPhotoId)
      : undefined;
    return {
      id: body.id,
      makeRaw: body.makeRaw,
      modelRaw: body.modelRaw,
      make: body.make,
      model: body.model,
      label: formatEquipmentDisplayLabel(body.makeRaw, body.modelRaw),
      serialNumber: body.serialNumber,
      deviceType: body.deviceType,
      confidence: body.confidence,
      photosCount: body.photosCount,
      firstSeenAt: body.firstSeenAt.toISOString(),
      lastSeenAt: body.lastSeenAt.toISOString(),
      maxShutterCount: body.maxShutterCount,
      maxShutterCountTakenAt: body.maxShutterCountTakenAt?.toISOString() ?? null,
      maxShutterCountUploadedAt: maxPhoto?.createdAt.toISOString() ?? null,
      maxShutterCountSourceField: body.maxShutterCountSourceField,
      maxShutterCountConfidence: body.maxShutterCountConfidence,
      maxShutterCountAlbum: body.maxShutterCountAlbumId
        ? {
            id: body.maxShutterCountAlbumId,
            title: albumTitleById.get(body.maxShutterCountAlbumId) ?? `Álbum #${body.maxShutterCountAlbumId}`,
          }
        : null,
      maxShutterCountPhoto: body.maxShutterCountPhotoId
        ? { id: body.maxShutterCountPhotoId, albumId: maxPhoto?.albumId ?? 0 }
        : null,
      lensesUsed: lensUsageByBody.get(body.id) ?? [],
    };
  });

  const combinationItems: PhotographicEquipmentCombinationItem[] = combinations.map((combo) => ({
    id: combo.id,
    bodyLabel: `${combo.cameraBody.makeRaw} ${combo.cameraBody.modelRaw}`.trim(),
    lensLabel: combo.lens
      ? `${combo.lens.makeRaw} ${combo.lens.modelRaw}`.trim()
      : null,
    photosCount: combo.photosCount,
    firstSeenAt: combo.firstSeenAt.toISOString(),
    lastSeenAt: combo.lastSeenAt.toISOString(),
    albumTitles: albumsByCombination.get(combo.id) ?? [],
  }));

  return {
    photographer,
    totals: {
      bodies: bodies.length,
      lenses: lenses.length,
      combinations: combinations.length,
      observations: observationsCount,
    },
    bodies: bodyCards,
    combinations: combinationItems,
  };
}

export type PhotographicEquipmentBodyListItem = {
  id: number;
  source: "body" | "legacy";
  photographer: {
    id: number;
    email: string;
    name: string | null;
  };
  equipmentLabel: string;
  deviceType: PhotographerDeviceType;
  serialNumber: string | null;
  primaryLensLabel: string | null;
  photosCount: number;
  confidence: PhotographicGearConfidence | string;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type PhotographicEquipmentEquipmentDetail = {
  source: "body" | "legacy";
  id: number;
  photographer: {
    id: number;
    email: string;
    name: string | null;
    handler: string | null;
  };
  equipmentLabel: string;
  deviceType: PhotographerDeviceType;
  confidence: PhotographicGearConfidence | string;
  serialNumber: string | null;
  photosCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  maxShutterCount: number | null;
  maxShutterCountTakenAt: string | null;
  maxShutterCountUploadedAt: string | null;
  maxShutterCountSourceField: string | null;
  maxShutterCountAlbum: { id: number; title: string } | null;
  maxShutterCountPhoto: { id: number; albumId: number } | null;
  lensesUsed: PhotographicEquipmentBodyLensUsage[];
  albums: Array<{
    id: number;
    title: string;
    eventTitle: string | null;
    photoCount: number;
    firstSeenAt: string;
    lastSeenAt: string;
  }>;
  recentPhotos: Array<{
    id: number;
    albumId: number;
    albumTitle: string;
    previewUrl: string;
    takenAt: string | null;
  }>;
  usageTimeline: Array<{ month: string; photoCount: number }>;
  combinations: PhotographicEquipmentCombinationItem[];
};

export type ListBodiesFilters = {
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function listPhotographicEquipmentBodies(
  filters: ListBodiesFilters = {}
): Promise<{
  bodies: PhotographicEquipmentBodyListItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 30));
  const skip = (page - 1) * pageSize;
  const search = filters.search?.trim();

  const v2Count = await prisma.photographicCameraBody.count({ where: ACTIVE_GEAR });

  if (v2Count > 0) {
    const where: Prisma.PhotographicCameraBodyWhereInput = { ...ACTIVE_GEAR };
    if (search) {
      where.OR = [
        { makeRaw: { contains: search, mode: "insensitive" } },
        { modelRaw: { contains: search, mode: "insensitive" } },
        { serialNumber: { contains: search, mode: "insensitive" } },
        {
          photographer: {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.photographicCameraBody.count({ where }),
      prisma.photographicCameraBody.findMany({
        where,
        orderBy: { lastSeenAt: "desc" },
        skip,
        take: pageSize,
        include: {
          photographer: { select: { id: true, email: true, name: true } },
          combinations: {
            take: 1,
            orderBy: { photosCount: "desc" },
            include: { lens: { select: { makeRaw: true, modelRaw: true } } },
          },
        },
      }),
    ]);

    const bodies: PhotographicEquipmentBodyListItem[] = rows.map((row) => {
      const topLens = row.combinations[0]?.lens;
      return {
        id: row.id,
        source: "body",
        photographer: row.photographer,
        equipmentLabel: formatEquipmentDisplayLabel(row.makeRaw, row.modelRaw),
        deviceType: row.deviceType,
        serialNumber: row.serialNumber,
        primaryLensLabel: topLens
          ? formatEquipmentDisplayLabel(topLens.makeRaw, topLens.modelRaw)
          : null,
        photosCount: row.photosCount,
        confidence: row.confidence,
        firstSeenAt: row.firstSeenAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
      };
    });

    return {
      bodies,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  const legacyWhere: Prisma.PhotographerDeviceWhereInput = {};
  if (search) {
    legacyWhere.OR = [
      { brand: { contains: search, mode: "insensitive" } },
      { model: { contains: search, mode: "insensitive" } },
      { serialNumber: { contains: search, mode: "insensitive" } },
      {
        photographer: {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.photographerDevice.count({ where: legacyWhere }),
    prisma.photographerDevice.findMany({
      where: legacyWhere,
      orderBy: { lastSeenAt: "desc" },
      skip,
      take: pageSize,
      include: { photographer: { select: { id: true, email: true, name: true } } },
    }),
  ]);

  const bodies: PhotographicEquipmentBodyListItem[] = rows.map((row) => ({
    id: row.id,
    source: "legacy",
    photographer: row.photographer,
    equipmentLabel: formatEquipmentDisplayLabel(row.brand, row.model),
    deviceType: row.deviceType,
    serialNumber: row.serialNumber,
    primaryLensLabel: [row.lensBrand, row.lensModel].filter(Boolean).join(" ") || null,
    photosCount: row.photoCount,
    confidence: row.confidence,
    firstSeenAt: row.firstSeenAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
  }));

  return {
    bodies,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

function buildUsageTimelineFromDates(dates: Date[]): Array<{ month: string; photoCount: number }> {
  const monthCounts = new Map<string, number>();
  for (const seenAt of dates) {
    const monthKey = `${seenAt.getUTCFullYear()}-${String(seenAt.getUTCMonth() + 1).padStart(2, "0")}`;
    monthCounts.set(monthKey, (monthCounts.get(monthKey) ?? 0) + 1);
  }
  return Array.from(monthCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, photoCount]) => ({ month, photoCount }));
}

export async function getPhotographicEquipmentBodyDetail(
  bodyId: number
): Promise<PhotographicEquipmentEquipmentDetail | null> {
  const body = await prisma.photographicCameraBody.findUnique({
    where: { id: bodyId },
    include: { photographer: { select: { id: true, email: true, name: true, handler: true } } },
  });
  if (!body) return null;

  const [observations, combinations, maxAlbum, maxPhoto] = await Promise.all([
    prisma.photographicGearObservation.findMany({
      where: { cameraBodyId: bodyId },
      orderBy: { takenAt: "desc" },
      take: 200,
      select: {
        takenAt: true,
        uploadedAt: true,
        album: { select: { id: true, title: true, eventId: true, event: { select: { title: true } } } },
        lens: { select: { id: true, makeRaw: true, modelRaw: true, make: true, model: true } },
        photo: { select: { id: true, albumId: true, previewUrl: true, createdAt: true } },
      },
    }),
    prisma.photographicGearCombination.findMany({
      where: { cameraBodyId: bodyId },
      include: { lens: { select: { makeRaw: true, modelRaw: true } } },
      orderBy: { lastSeenAt: "desc" },
    }),
    body.maxShutterCountAlbumId
      ? prisma.album.findUnique({
          where: { id: body.maxShutterCountAlbumId },
          select: { id: true, title: true },
        })
      : Promise.resolve(null),
    body.maxShutterCountPhotoId
      ? prisma.photo.findUnique({
          where: { id: body.maxShutterCountPhotoId },
          select: { id: true, albumId: true, createdAt: true },
        })
      : Promise.resolve(null),
  ]);

  const lensUsageMap = new Map<
    string,
    { lensId: number | null; lensLabel: string; photosCount: number; firstSeenAt: Date; lastSeenAt: Date }
  >();
  const albumMap = new Map<
    number,
    {
      id: number;
      title: string;
      eventTitle: string | null;
      photoCount: number;
      firstSeenAt: Date;
      lastSeenAt: Date;
    }
  >();
  const seenDates: Date[] = [];

  for (const obs of observations) {
    const seenAt = obs.takenAt ?? obs.uploadedAt;
    seenDates.push(seenAt);

    const lensKey = obs.lens ? String(obs.lens.id) : "none";
    const lensLabel = obs.lens
      ? formatEquipmentDisplayLabel(obs.lens.makeRaw, obs.lens.modelRaw)
      : "Sin lente en EXIF";
    const lensEntry = lensUsageMap.get(lensKey);
    if (lensEntry) {
      lensEntry.photosCount += 1;
      if (seenAt < lensEntry.firstSeenAt) lensEntry.firstSeenAt = seenAt;
      if (seenAt > lensEntry.lastSeenAt) lensEntry.lastSeenAt = seenAt;
    } else {
      lensUsageMap.set(lensKey, {
        lensId: obs.lens?.id ?? null,
        lensLabel,
        photosCount: 1,
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
      });
    }

    const album = obs.album;
    const albumEntry = albumMap.get(album.id);
    if (albumEntry) {
      albumEntry.photoCount += 1;
      if (seenAt < albumEntry.firstSeenAt) albumEntry.firstSeenAt = seenAt;
      if (seenAt > albumEntry.lastSeenAt) albumEntry.lastSeenAt = seenAt;
    } else {
      albumMap.set(album.id, {
        id: album.id,
        title: album.title,
        eventTitle: album.event?.title ?? null,
        photoCount: 1,
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
      });
    }
  }

  const combinationAlbums = await prisma.$queryRaw<Array<{ combinationId: number; albumTitle: string }>>`
    SELECT o."combinationId", a.title AS "albumTitle"
    FROM "PhotographicGearObservation" o
    INNER JOIN "Album" a ON a.id = o."albumId"
    WHERE o."cameraBodyId" = ${bodyId} AND o."combinationId" IS NOT NULL
    GROUP BY o."combinationId", a.title
    ORDER BY a.title
  `;
  const albumsByCombination = new Map<number, string[]>();
  for (const row of combinationAlbums) {
    if (row.combinationId == null) continue;
    const list = albumsByCombination.get(row.combinationId) ?? [];
    list.push(row.albumTitle);
    albumsByCombination.set(row.combinationId, list);
  }

  return {
    source: "body",
    id: body.id,
    photographer: body.photographer,
    equipmentLabel: formatEquipmentDisplayLabel(body.makeRaw, body.modelRaw),
    deviceType: body.deviceType,
    confidence: body.confidence,
    serialNumber: body.serialNumber,
    photosCount: body.photosCount,
    firstSeenAt: body.firstSeenAt.toISOString(),
    lastSeenAt: body.lastSeenAt.toISOString(),
    maxShutterCount: body.maxShutterCount,
    maxShutterCountTakenAt: body.maxShutterCountTakenAt?.toISOString() ?? null,
    maxShutterCountUploadedAt: maxPhoto?.createdAt.toISOString() ?? null,
    maxShutterCountSourceField: body.maxShutterCountSourceField,
    maxShutterCountAlbum: maxAlbum,
    maxShutterCountPhoto: maxPhoto ? { id: maxPhoto.id, albumId: maxPhoto.albumId } : null,
    lensesUsed: Array.from(lensUsageMap.values())
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
      .map((l) => ({
        lensId: l.lensId,
        lensLabel: l.lensLabel,
        photosCount: l.photosCount,
        firstSeenAt: l.firstSeenAt.toISOString(),
        lastSeenAt: l.lastSeenAt.toISOString(),
      })),
    albums: Array.from(albumMap.values())
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
      .map((a) => ({
        id: a.id,
        title: a.title,
        eventTitle: a.eventTitle,
        photoCount: a.photoCount,
        firstSeenAt: a.firstSeenAt.toISOString(),
        lastSeenAt: a.lastSeenAt.toISOString(),
      })),
    recentPhotos: observations.slice(0, 12).map((obs) => ({
      id: obs.photo.id,
      albumId: obs.photo.albumId,
      albumTitle: obs.album.title,
      previewUrl: obs.photo.previewUrl,
      takenAt: obs.takenAt?.toISOString() ?? null,
    })),
    usageTimeline: buildUsageTimelineFromDates(seenDates),
    combinations: combinations.map((combo) => ({
      id: combo.id,
      bodyLabel: formatEquipmentDisplayLabel(body.makeRaw, body.modelRaw),
      lensLabel: combo.lens
        ? formatEquipmentDisplayLabel(combo.lens.makeRaw, combo.lens.modelRaw)
        : null,
      photosCount: combo.photosCount,
      firstSeenAt: combo.firstSeenAt.toISOString(),
      lastSeenAt: combo.lastSeenAt.toISOString(),
      albumTitles: albumsByCombination.get(combo.id) ?? [],
    })),
  };
}

export async function getPhotographicEquipmentLegacyDeviceDetail(
  deviceId: number
): Promise<PhotographicEquipmentEquipmentDetail | null> {
  const device = await prisma.photographerDevice.findUnique({
    where: { id: deviceId },
    include: {
      photographer: { select: { id: true, email: true, name: true, handler: true } },
      exifMetadata: {
        orderBy: { analyzedAt: "desc" },
        take: 200,
        select: {
          takenAt: true,
          analyzedAt: true,
          lensMake: true,
          lensModel: true,
          photo: {
            select: {
              id: true,
              albumId: true,
              previewUrl: true,
              createdAt: true,
              album: {
                select: {
                  id: true,
                  title: true,
                  eventId: true,
                  event: { select: { title: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!device) return null;

  const albumMap = new Map<
    number,
    {
      id: number;
      title: string;
      eventTitle: string | null;
      photoCount: number;
      firstSeenAt: Date;
      lastSeenAt: Date;
    }
  >();
  const lensUsageMap = new Map<
    string,
    { lensId: null; lensLabel: string; photosCount: number; firstSeenAt: Date; lastSeenAt: Date }
  >();
  const seenDates: Date[] = [];

  for (const meta of device.exifMetadata) {
    const seenAt = meta.takenAt ?? meta.photo.createdAt;
    seenDates.push(seenAt);

    const lensLabel =
      [meta.lensMake, meta.lensModel].filter(Boolean).join(" ") ||
      [device.lensBrand, device.lensModel].filter(Boolean).join(" ") ||
      "Sin lente en EXIF";
    const lensKey = lensLabel.toLowerCase();
    const lensEntry = lensUsageMap.get(lensKey);
    if (lensEntry) {
      lensEntry.photosCount += 1;
      if (seenAt < lensEntry.firstSeenAt) lensEntry.firstSeenAt = seenAt;
      if (seenAt > lensEntry.lastSeenAt) lensEntry.lastSeenAt = seenAt;
    } else {
      lensUsageMap.set(lensKey, {
        lensId: null,
        lensLabel,
        photosCount: 1,
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
      });
    }

    const album = meta.photo.album;
    const albumEntry = albumMap.get(album.id);
    if (albumEntry) {
      albumEntry.photoCount += 1;
      if (seenAt < albumEntry.firstSeenAt) albumEntry.firstSeenAt = seenAt;
      if (seenAt > albumEntry.lastSeenAt) albumEntry.lastSeenAt = seenAt;
    } else {
      albumMap.set(album.id, {
        id: album.id,
        title: album.title,
        eventTitle: album.event?.title ?? null,
        photoCount: 1,
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
      });
    }
  }

  const primaryLens = [device.lensBrand, device.lensModel].filter(Boolean).join(" ") || null;

  return {
    source: "legacy",
    id: device.id,
    photographer: device.photographer,
    equipmentLabel: formatEquipmentDisplayLabel(device.brand, device.model),
    deviceType: device.deviceType,
    confidence: device.confidence,
    serialNumber: device.serialNumber,
    photosCount: device.photoCount,
    firstSeenAt: device.firstSeenAt.toISOString(),
    lastSeenAt: device.lastSeenAt.toISOString(),
    maxShutterCount: null,
    maxShutterCountTakenAt: null,
    maxShutterCountUploadedAt: null,
    maxShutterCountSourceField: null,
    maxShutterCountAlbum: null,
    maxShutterCountPhoto: null,
    lensesUsed: Array.from(lensUsageMap.values())
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
      .map((l) => ({
        lensId: l.lensId,
        lensLabel: l.lensLabel,
        photosCount: l.photosCount,
        firstSeenAt: l.firstSeenAt.toISOString(),
        lastSeenAt: l.lastSeenAt.toISOString(),
      })),
    albums: Array.from(albumMap.values())
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
      .map((a) => ({
        id: a.id,
        title: a.title,
        eventTitle: a.eventTitle,
        photoCount: a.photoCount,
        firstSeenAt: a.firstSeenAt.toISOString(),
        lastSeenAt: a.lastSeenAt.toISOString(),
      })),
    recentPhotos: device.exifMetadata.slice(0, 12).map((meta) => ({
      id: meta.photo.id,
      albumId: meta.photo.albumId,
      albumTitle: meta.photo.album.title,
      previewUrl: meta.photo.previewUrl,
      takenAt: meta.takenAt?.toISOString() ?? null,
    })),
    usageTimeline: buildUsageTimelineFromDates(seenDates),
    combinations: primaryLens
      ? [
          {
            id: device.id,
            bodyLabel: formatEquipmentDisplayLabel(device.brand, device.model),
            lensLabel: primaryLens,
            photosCount: device.photoCount,
            firstSeenAt: device.firstSeenAt.toISOString(),
            lastSeenAt: device.lastSeenAt.toISOString(),
            albumTitles: Array.from(albumMap.values()).map((a) => a.title),
          },
        ]
      : [],
  };
}

export async function getPhotographicEquipmentEquipmentDetail(
  id: number,
  source?: "body" | "legacy"
): Promise<PhotographicEquipmentEquipmentDetail | null> {
  if (source === "legacy") {
    return getPhotographicEquipmentLegacyDeviceDetail(id);
  }
  const bodyDetail = await getPhotographicEquipmentBodyDetail(id);
  if (bodyDetail) return bodyDetail;
  if (source === "body") return null;
  return getPhotographicEquipmentLegacyDeviceDetail(id);
}

export async function getPhotographicEquipmentJobStatus(): Promise<PhotographicEquipmentJobStatus> {
  const [pendingPhotos, lastAnalyzed, recentFailures, lease, scanState] = await Promise.all([
    prisma.photo.count({ where: pendingExifPhotoWhere }),
    prisma.photoExifMetadata.findFirst({
      where: { analyzedAt: { not: null } },
      orderBy: { analyzedAt: "desc" },
      select: { analyzedAt: true },
    }),
    prisma.photoExifMetadata.count({
      where: {
        status: "FAILED" satisfies PhotoExifMetadataStatus,
        analyzedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    getExifDeviceScanLease(),
    getExifDeviceScanStateSnapshot(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    enabled: isExifDeviceScanEnabled(),
    backfillEnabled: isExifDeviceScanBackfillEnabled(),
    inWindow: isWithinExifDeviceScanWindow(),
    timezone: getExifDeviceScanTimezone(),
    batchSize: getExifDeviceScanBatchSize(),
    backfillBatchSize: getExifDeviceScanBackfillBatchSize(),
    dailyBatchSize: getExifDeviceScanDailyBatchSize(),
    mode: scanState.mode,
    isBackfillComplete: scanState.isBackfillComplete,
    pendingPhotos,
    lastRunAt: scanState.lastRunAt,
    lastCompletedAt: scanState.lastCompletedAt,
    lastBatchAt: scanState.lastBatchAt,
    lastBatchProcessed: scanState.lastBatchProcessed,
    lastBatchAnalyzed: scanState.lastBatchAnalyzed,
    processedTotal: scanState.processedTotal,
    analyzedTotal: scanState.analyzedTotal,
    noExifTotal: scanState.noExifTotal,
    failedTotal: scanState.failedTotal,
    lastAnalyzedAt: lastAnalyzed?.analyzedAt?.toISOString() ?? null,
    recentFailures,
    lease,
  };
}
