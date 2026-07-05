import { Prisma, type PrismaClient } from "@prisma/client";
import { buildOrdersBaseCte, periodCutoffSql } from "./orders-base-cte";
import type {
  AdminConversionAnalytics,
  AlbumConversionRankRow,
  ConversionDailyPoint,
  ConversionSummary,
  ConversionUxFunnelEvent,
  PhotographerConversionAnalytics,
  PhotographerConversionRankRow,
  RecoveredRevenue,
  RecoveryReasonBreakdown,
} from "./types";

const TZ = "America/Argentina/Buenos_Aires";

const UX_FUNNEL_EVENTS = [
  "PAYMENT_REDIRECT_PREPARING_SHOWN",
  "PAYMENT_RETRY_CLICKED",
  "PENDING_ORDER_BANNER_CONTINUE_CLICKED",
  "PENDING_ORDER_BANNER_SHOWN",
  "PENDING_ORDER_BANNER_DISMISSED",
  "PAYMENT_PENDING_STATUS_REFRESHED",
] as const;

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function mapSummaryRow(row: {
  purchase_attempts: number;
  completed_purchases: number;
  recovered_abandonments: number;
  real_abandonments: number;
}): ConversionSummary {
  const purchaseAttempts = Number(row.purchase_attempts) || 0;
  const completedPurchases = Number(row.completed_purchases) || 0;
  const recoveredAbandonments = Number(row.recovered_abandonments) || 0;
  const realAbandonments = Number(row.real_abandonments) || 0;
  const abandonTotal = recoveredAbandonments + realAbandonments;
  return {
    purchaseAttempts,
    completedPurchases,
    conversionRatePct: pct(completedPurchases, purchaseAttempts),
    recoveredAbandonments,
    realAbandonments,
    recoveryRatePct: pct(recoveredAbandonments, abandonTotal),
  };
}

function mapReasonsRow(row: {
  mismo_carrito: number;
  menos_fotos: number;
  cambio_productos: number;
  cambio_completo: number;
}): RecoveryReasonBreakdown {
  return {
    same_cart: Number(row.mismo_carrito) || 0,
    fewer_photos: Number(row.menos_fotos) || 0,
    product_change: Number(row.cambio_productos) || 0,
    complete_change: Number(row.cambio_completo) || 0,
  };
}

export async function resolvePhotographerAlbumIds(
  prisma: PrismaClient,
  photographerId: number
): Promise<number[]> {
  const albums = await prisma.album.findMany({
    where: {
      deletedAt: null,
      OR: [
        { userId: photographerId },
        { photos: { some: { userId: photographerId } } },
      ],
    },
    select: { id: true },
  });
  return albums.map((a) => a.id);
}

async function querySummary(
  prisma: PrismaClient,
  albumIds: number[] | undefined,
  days: number
): Promise<ConversionSummary> {
  const cte = buildOrdersBaseCte(albumIds);
  const cutoff = periodCutoffSql(days);

  const rows = await prisma.$queryRaw<
    Array<{
      purchase_attempts: number;
      completed_purchases: number;
      recovered_abandonments: number;
      real_abandonments: number;
    }>
  >`
    WITH ${cte}
    SELECT
      COUNT(*)::int AS purchase_attempts,
      COUNT(*) FILTER (WHERE status = 'PAID')::int AS completed_purchases,
      COUNT(DISTINCT buyer_key_album) FILTER (
        WHERE status = 'PENDING'
          AND buyer_key_album IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM orders_base x
            WHERE x.buyer_key_album = orders_base.buyer_key_album
              AND x.status = 'PAID'
              AND x."createdAt" > orders_base."createdAt"
          )
      )::int AS recovered_abandonments,
      COUNT(DISTINCT buyer_key_album) FILTER (
        WHERE status = 'PENDING'
          AND buyer_key_album IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM orders_base x
            WHERE x.buyer_key_album = orders_base.buyer_key_album
              AND x.status = 'PAID'
          )
      )::int AS real_abandonments
    FROM orders_base
    WHERE "createdAt" >= ${cutoff}
      AND buyer_key_album IS NOT NULL
  `;

  return mapSummaryRow(
    rows[0] ?? {
      purchase_attempts: 0,
      completed_purchases: 0,
      recovered_abandonments: 0,
      real_abandonments: 0,
    }
  );
}

async function queryRecoveryReasons(
  prisma: PrismaClient,
  albumIds: number[] | undefined,
  days: number
): Promise<RecoveryReasonBreakdown> {
  const cte = buildOrdersBaseCte(albumIds);
  const cutoff = periodCutoffSql(days);

  const rows = await prisma.$queryRaw<
    Array<{
      mismo_carrito: number;
      menos_fotos: number;
      cambio_productos: number;
      cambio_completo: number;
    }>
  >`
    WITH ${cte},
    pairs AS (
      SELECT p.id AS pending_id, paid.id AS paid_id
      FROM orders_base p
      JOIN LATERAL (
        SELECT x.id
        FROM orders_base x
        WHERE x.buyer_key_album = p.buyer_key_album
          AND x.status = 'PAID'
          AND x."createdAt" > p."createdAt"
        ORDER BY x."createdAt" ASC
        LIMIT 1
      ) paid ON true
      WHERE p.status = 'PENDING'
        AND p.buyer_key_album IS NOT NULL
        AND p."createdAt" >= ${cutoff}
    ),
    sig AS (
      SELECT oi."orderId",
        COUNT(DISTINCT oi."photoId")::int AS photos,
        array_agg(DISTINCT oi."photoId" ORDER BY oi."photoId") AS photo_ids,
        array_agg(
          oi."photoId"::text || ':' || oi."productType"::text || ':' || coalesce(oi.size, '') || ':' || coalesce(oi.finish, '') || ':' || oi.quantity::text
          ORDER BY oi."photoId", oi."productType", oi.size, oi.finish, oi.quantity
        ) AS line_sig
      FROM "OrderItem" oi
      GROUP BY oi."orderId"
    )
    SELECT
      COUNT(*) FILTER (WHERE sp.line_sig = sa.line_sig)::int AS mismo_carrito,
      COUNT(*) FILTER (
        WHERE sp.line_sig IS DISTINCT FROM sa.line_sig
          AND sa.photos < sp.photos
          AND sa.photo_ids <@ sp.photo_ids
      )::int AS menos_fotos,
      COUNT(*) FILTER (
        WHERE sp.line_sig IS DISTINCT FROM sa.line_sig
          AND sa.photos = sp.photos
          AND sa.photo_ids = sp.photo_ids
      )::int AS cambio_productos,
      COUNT(*) FILTER (
        WHERE sp.line_sig IS DISTINCT FROM sa.line_sig
          AND NOT (sa.photos < sp.photos AND sa.photo_ids <@ sp.photo_ids)
          AND NOT (sa.photos = sp.photos AND sa.photo_ids = sp.photo_ids)
      )::int AS cambio_completo
    FROM pairs
    JOIN sig sp ON sp."orderId" = pairs.pending_id
    JOIN sig sa ON sa."orderId" = pairs.paid_id
  `;

  return mapReasonsRow(
    rows[0] ?? {
      mismo_carrito: 0,
      menos_fotos: 0,
      cambio_productos: 0,
      cambio_completo: 0,
    }
  );
}

async function queryRecoveredRevenue(
  prisma: PrismaClient,
  albumIds: number[] | undefined,
  days: number
): Promise<RecoveredRevenue> {
  const cte = buildOrdersBaseCte(albumIds);
  const cutoff = periodCutoffSql(days);

  const rows = await prisma.$queryRaw<
    Array<{ recovery_pairs: number; total_cents: number | null }>
  >`
    WITH ${cte},
    pairs AS (
      SELECT
        p.buyer_key_album,
        paid.id AS paid_id,
        paid."totalCents" AS paid_total
      FROM orders_base p
      JOIN LATERAL (
        SELECT x.id, x."totalCents"
        FROM orders_base x
        WHERE x.buyer_key_album = p.buyer_key_album
          AND x.status = 'PAID'
          AND x."createdAt" > p."createdAt"
        ORDER BY x."createdAt" ASC
        LIMIT 1
      ) paid ON true
      WHERE p.status = 'PENDING'
        AND p.buyer_key_album IS NOT NULL
        AND p."createdAt" >= ${cutoff}
    ),
    unique_recoveries AS (
      SELECT buyer_key_album, paid_id, MAX(paid_total) AS paid_total
      FROM pairs
      GROUP BY buyer_key_album, paid_id
    )
    SELECT
      COUNT(*)::int AS recovery_pairs,
      COALESCE(SUM(paid_total), 0)::int AS total_cents
    FROM unique_recoveries
  `;

  const recoveryPairs = Number(rows[0]?.recovery_pairs) || 0;
  const totalCents = Number(rows[0]?.total_cents) || 0;
  return {
    recoveryPairs,
    totalArs: totalCents,
    averageTicketArs: recoveryPairs > 0 ? Math.round(totalCents / recoveryPairs) : 0,
  };
}

async function queryDailySeries(
  prisma: PrismaClient,
  albumIds: number[] | undefined,
  days: number
): Promise<ConversionDailyPoint[]> {
  const cte = buildOrdersBaseCte(albumIds);
  const cutoff = periodCutoffSql(days);

  const rows = await prisma.$queryRaw<
    Array<{
      day: Date;
      attempts: number;
      purchases: number;
      recoveries: number;
    }>
  >`
    WITH ${cte},
    daily AS (
      SELECT
        (o."createdAt" AT TIME ZONE ${TZ})::date AS day,
        COUNT(*)::int AS attempts,
        COUNT(*) FILTER (WHERE o.status = 'PAID')::int AS purchases
      FROM orders_base o
      WHERE o."createdAt" >= ${cutoff}
      GROUP BY 1
    ),
    recovery_daily AS (
      SELECT
        (paid."createdAt" AT TIME ZONE ${TZ})::date AS day,
        COUNT(*)::int AS recoveries
      FROM orders_base p
      JOIN LATERAL (
        SELECT x."createdAt"
        FROM orders_base x
        WHERE x.buyer_key_album = p.buyer_key_album
          AND x.status = 'PAID'
          AND x."createdAt" > p."createdAt"
        ORDER BY x."createdAt" ASC
        LIMIT 1
      ) paid ON true
      WHERE p.status = 'PENDING'
        AND p.buyer_key_album IS NOT NULL
        AND paid."createdAt" >= ${cutoff}
      GROUP BY 1
    )
    SELECT
      d.day,
      d.attempts,
      d.purchases,
      COALESCE(r.recoveries, 0)::int AS recoveries
    FROM daily d
    LEFT JOIN recovery_daily r ON r.day = d.day
    ORDER BY d.day ASC
  `;

  return rows.map((r) => ({
    date: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10),
    attempts: Number(r.attempts) || 0,
    purchases: Number(r.purchases) || 0,
    conversionRatePct: pct(Number(r.purchases) || 0, Number(r.attempts) || 0),
    recoveries: Number(r.recoveries) || 0,
  }));
}

async function queryAlbumRankings(
  prisma: PrismaClient,
  days: number,
  limit: number,
  direction: "best" | "worst"
): Promise<AlbumConversionRankRow[]> {
  const cte = buildOrdersBaseCte();
  const cutoff = periodCutoffSql(days);
  const orderDir = direction === "best" ? Prisma.sql`DESC` : Prisma.sql`ASC`;

  const rows = await prisma.$queryRaw<
    Array<{
      album_id: number;
      album_title: string | null;
      attempts: number;
      purchases: number;
    }>
  >`
    WITH ${cte},
    by_album AS (
      SELECT
        o."albumId" AS album_id,
        COUNT(*)::int AS attempts,
        COUNT(*) FILTER (WHERE o.status = 'PAID')::int AS purchases
      FROM orders_base o
      WHERE o."createdAt" >= ${cutoff}
      GROUP BY o."albumId"
      HAVING COUNT(*) >= 3
    )
    SELECT
      b.album_id,
      a.title AS album_title,
      b.attempts,
      b.purchases
    FROM by_album b
    JOIN "Album" a ON a.id = b.album_id
    ORDER BY (b.purchases::float / NULLIF(b.attempts, 0)) ${orderDir}, b.attempts DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    albumId: Number(r.album_id),
    albumTitle: r.album_title,
    attempts: Number(r.attempts) || 0,
    purchases: Number(r.purchases) || 0,
    conversionRatePct: pct(Number(r.purchases) || 0, Number(r.attempts) || 0),
  }));
}

async function queryPhotographerRankings(
  prisma: PrismaClient,
  days: number,
  limit: number,
  direction: "best" | "worst"
): Promise<PhotographerConversionRankRow[]> {
  const cte = buildOrdersBaseCte();
  const cutoff = periodCutoffSql(days);
  const orderDir = direction === "best" ? Prisma.sql`DESC` : Prisma.sql`ASC`;

  const rows = await prisma.$queryRaw<
    Array<{
      photographer_id: number;
      name: string | null;
      email: string;
      attempts: number;
      purchases: number;
    }>
  >`
    WITH ${cte},
    by_photographer AS (
      SELECT
        a."userId" AS photographer_id,
        COUNT(*)::int AS attempts,
        COUNT(*) FILTER (WHERE o.status = 'PAID')::int AS purchases
      FROM orders_base o
      JOIN "Album" a ON a.id = o."albumId"
      WHERE o."createdAt" >= ${cutoff}
        AND a."userId" IS NOT NULL
      GROUP BY a."userId"
      HAVING COUNT(*) >= 5
    )
    SELECT
      b.photographer_id,
      u.name,
      u.email,
      b.attempts,
      b.purchases
    FROM by_photographer b
    JOIN "User" u ON u.id = b.photographer_id
    ORDER BY (b.purchases::float / NULLIF(b.attempts, 0)) ${orderDir}, b.attempts DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    photographerId: Number(r.photographer_id),
    name: r.name,
    email: r.email,
    attempts: Number(r.attempts) || 0,
    purchases: Number(r.purchases) || 0,
    conversionRatePct: pct(Number(r.purchases) || 0, Number(r.attempts) || 0),
  }));
}

async function queryUxFunnelEvents(
  prisma: PrismaClient,
  days: number
): Promise<ConversionUxFunnelEvent[]> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);

  try {
    const rows = await prisma.$queryRaw<
      Array<{ event: string; visits: number; visitors: number }>
    >`
      SELECT
        f.event,
        COUNT(*)::int AS visits,
        COUNT(DISTINCT f."visitorKey")::int AS visitors
      FROM "FunnelVisit" f
      WHERE f."createdAt" >= ${cutoff}
        AND f.event = ANY(${[...UX_FUNNEL_EVENTS]}::text[])
      GROUP BY f.event
      ORDER BY visits DESC
    `;

    const byEvent = new Map(rows.map((r) => [r.event, r]));
    return UX_FUNNEL_EVENTS.map((event) => {
      const row = byEvent.get(event);
      return {
        event,
        visits: Number(row?.visits) || 0,
        visitors: Number(row?.visitors) || 0,
      };
    });
  } catch {
    return UX_FUNNEL_EVENTS.map((event) => ({ event, visits: 0, visitors: 0 }));
  }
}

export async function computePhotographerConversionAnalytics(
  prisma: PrismaClient,
  photographerId: number,
  days = 90
): Promise<PhotographerConversionAnalytics> {
  const albumIds = await resolvePhotographerAlbumIds(prisma, photographerId);
  if (albumIds.length === 0) {
    return {
      periodDays: days,
      summary: {
        purchaseAttempts: 0,
        completedPurchases: 0,
        conversionRatePct: 0,
        recoveredAbandonments: 0,
        realAbandonments: 0,
        recoveryRatePct: 0,
      },
      recoveryReasons: {
        same_cart: 0,
        fewer_photos: 0,
        product_change: 0,
        complete_change: 0,
      },
      recoveredRevenue: { totalArs: 0, averageTicketArs: 0, recoveryPairs: 0 },
    };
  }

  const [summary, recoveryReasons, recoveredRevenue] = await Promise.all([
    querySummary(prisma, albumIds, days),
    queryRecoveryReasons(prisma, albumIds, days),
    queryRecoveredRevenue(prisma, albumIds, days),
  ]);

  return { periodDays: days, summary, recoveryReasons, recoveredRevenue };
}

export async function computeAdminConversionAnalytics(
  prisma: PrismaClient,
  days = 90
): Promise<AdminConversionAnalytics> {
  const [
    summary,
    recoveryReasons,
    recoveredRevenue,
    dailySeries,
    topAlbums,
    bottomAlbums,
    topPhotographers,
    bottomPhotographers,
    uxFunnelEvents,
  ] = await Promise.all([
    querySummary(prisma, undefined, days),
    queryRecoveryReasons(prisma, undefined, days),
    queryRecoveredRevenue(prisma, undefined, days),
    queryDailySeries(prisma, undefined, days),
    queryAlbumRankings(prisma, days, 10, "best"),
    queryAlbumRankings(prisma, days, 10, "worst"),
    queryPhotographerRankings(prisma, days, 10, "best"),
    queryPhotographerRankings(prisma, days, 10, "worst"),
    queryUxFunnelEvents(prisma, days),
  ]);

  return {
    periodDays: days,
    summary,
    recoveryReasons,
    recoveredRevenue,
    dailySeries,
    topAlbums,
    bottomAlbums,
    topPhotographers,
    bottomPhotographers,
    uxFunnelEvents,
  };
}
