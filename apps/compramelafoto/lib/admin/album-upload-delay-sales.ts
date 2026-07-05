import type { PrismaClient } from "@prisma/client";

const DEFAULT_MONTHS = 18;

export type AlbumUploadDelayBucketRow = {
  bucketKey: string;
  bucketLabel: string;
  albumCount: number;
  albumsWithSales: number;
  totalSalesArs: number;
  avgSalesPerAlbum: number;
  avgDelayDays: number;
};

export type AlbumUploadDelayTopRow = {
  albumId: number;
  title: string;
  eventDate: string;
  firstUploadAt: string;
  uploadDelayDays: number;
  salesArs: number;
  ordersCount: number;
};

export type AlbumUploadDelaySalesStudy = {
  monthsBack: number;
  albumsAnalyzed: number;
  albumsWithSales: number;
  avgDelayDaysAll: number;
  avgDelayDaysWithSales: number;
  /** Promedio de ventas (ARS) — subida el mismo día o al día siguiente del evento */
  fastUploadAvgSales: number;
  /** Promedio de ventas (ARS) — primera foto más de 7 días después del evento */
  slowUploadAvgSales: number;
  /** % más ventas en rápidos vs lentos (null si no hay datos) */
  salesLiftFastVsSlowPercent: number | null;
  /** Correlación Pearson demora (días) vs ventas totales del álbum */
  correlationDelaySales: number | null;
  buckets: AlbumUploadDelayBucketRow[];
  topAlbumsBySales: AlbumUploadDelayTopRow[];
};

type RawAlbumRow = {
  album_id: number;
  title: string;
  event_date: Date;
  first_upload_at: Date;
  upload_delay_days: number;
  sales_ars: number;
  orders_count: number;
};

function delayBucket(delayDays: number): { key: string; label: string } {
  if (delayDays < 1) return { key: "0", label: "Mismo día" };
  if (delayDays < 2) return { key: "1", label: "1 día" };
  if (delayDays < 4) return { key: "2-3", label: "2–3 días" };
  if (delayDays < 8) return { key: "4-7", label: "4–7 días" };
  if (delayDays < 15) return { key: "8-14", label: "8–14 días" };
  if (delayDays < 31) return { key: "15-30", label: "15–30 días" };
  return { key: "31+", label: "Más de 30 días" };
}

const BUCKET_ORDER = ["0", "1", "2-3", "4-7", "8-14", "15-30", "31+"];

function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (den === 0) return null;
  return Math.round((num / den) * 1000) / 1000;
}

/**
 * Relación entre demora de publicación (evento → primera foto) y ventas PAID del álbum.
 * Solo álbumes con eventDate y al menos una foto subida.
 */
export async function computeAlbumUploadDelaySales(
  prisma: PrismaClient,
  monthsBack = DEFAULT_MONTHS
): Promise<AlbumUploadDelaySalesStudy> {
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - monthsBack);

  const rows = await prisma.$queryRaw<RawAlbumRow[]>`
    WITH album_upload AS (
      SELECT
        a.id AS album_id,
        a.title,
        a."eventDate" AS event_date,
        COALESCE(a."firstPhotoDate", MIN(p."createdAt")) AS first_upload_at
      FROM "Album" a
      INNER JOIN "Photo" p ON p."albumId" = a.id AND p."isRemoved" = false
      WHERE a."deletedAt" IS NULL
        AND a."eventDate" IS NOT NULL
        AND a."eventDate" >= ${cutoff}
      GROUP BY a.id, a.title, a."eventDate", a."firstPhotoDate"
    ),
    album_sales AS (
      SELECT
        o."albumId" AS album_id,
        COALESCE(SUM(o."totalCents"), 0)::int AS sales_ars,
        COUNT(*)::int AS orders_count
      FROM "Order" o
      WHERE o.status = 'PAID'
        AND o."isTest" = false
      GROUP BY o."albumId"
    )
    SELECT
      u.album_id,
      u.title,
      u.event_date,
      u.first_upload_at,
      GREATEST(
        EXTRACT(EPOCH FROM (u.first_upload_at - u.event_date)) / 86400.0,
        0
      )::float AS upload_delay_days,
      COALESCE(s.sales_ars, 0)::int AS sales_ars,
      COALESCE(s.orders_count, 0)::int AS orders_count
    FROM album_upload u
    LEFT JOIN album_sales s ON s.album_id = u.album_id
    WHERE u.first_upload_at IS NOT NULL
    ORDER BY sales_ars DESC, upload_delay_days ASC
  `;

  const albums = rows.map((r) => ({
    albumId: Number(r.album_id),
    title: r.title,
    eventDate: r.event_date instanceof Date ? r.event_date : new Date(r.event_date),
    firstUploadAt:
      r.first_upload_at instanceof Date ? r.first_upload_at : new Date(r.first_upload_at),
    uploadDelayDays: Math.round(Number(r.upload_delay_days) * 10) / 10,
    salesArs: Number(r.sales_ars),
    ordersCount: Number(r.orders_count),
  }));

  const withSales = albums.filter((a) => a.salesArs > 0);
  const fast = withSales.filter((a) => a.uploadDelayDays <= 1);
  const slow = withSales.filter((a) => a.uploadDelayDays > 7);

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

  const fastAvg = avg(fast.map((a) => a.salesArs));
  const slowAvg = avg(slow.map((a) => a.salesArs));
  const salesLiftFastVsSlowPercent =
    slowAvg > 0 ? Math.round(((fastAvg - slowAvg) / slowAvg) * 1000) / 10 : null;

  const bucketMap = new Map<
    string,
    { label: string; albums: typeof albums }
  >();

  for (const a of albums) {
    const { key, label } = delayBucket(a.uploadDelayDays);
    const entry = bucketMap.get(key) ?? { label, albums: [] };
    entry.albums.push(a);
    bucketMap.set(key, entry);
  }

  const buckets: AlbumUploadDelayBucketRow[] = BUCKET_ORDER.filter((k) =>
    bucketMap.has(k)
  ).map((key) => {
    const { label, albums: group } = bucketMap.get(key)!;
    const withSalesInBucket = group.filter((a) => a.salesArs > 0);
    const totalSales = group.reduce((s, a) => s + a.salesArs, 0);
    const avgDelay =
      group.length > 0
        ? Math.round(
            (group.reduce((s, a) => s + a.uploadDelayDays, 0) / group.length) * 10
          ) / 10
        : 0;
    return {
      bucketKey: key,
      bucketLabel: label,
      albumCount: group.length,
      albumsWithSales: withSalesInBucket.length,
      totalSalesArs: totalSales,
      avgSalesPerAlbum: group.length > 0 ? Math.round(totalSales / group.length) : 0,
      avgDelayDays: avgDelay,
    };
  });

  const correlationDelaySales = pearsonCorrelation(
    withSales.map((a) => a.uploadDelayDays),
    withSales.map((a) => a.salesArs)
  );

  const topAlbumsBySales: AlbumUploadDelayTopRow[] = withSales.slice(0, 15).map((a) => ({
    albumId: a.albumId,
    title: a.title,
    eventDate: a.eventDate.toISOString(),
    firstUploadAt: a.firstUploadAt.toISOString(),
    uploadDelayDays: a.uploadDelayDays,
    salesArs: a.salesArs,
    ordersCount: a.ordersCount,
  }));

  return {
    monthsBack,
    albumsAnalyzed: albums.length,
    albumsWithSales: withSales.length,
    avgDelayDaysAll:
      albums.length > 0
        ? Math.round(
            (albums.reduce((s, a) => s + a.uploadDelayDays, 0) / albums.length) * 10
          ) / 10
        : 0,
    avgDelayDaysWithSales:
      withSales.length > 0
        ? Math.round(
            (withSales.reduce((s, a) => s + a.uploadDelayDays, 0) / withSales.length) * 10
          ) / 10
        : 0,
    fastUploadAvgSales: fastAvg,
    slowUploadAvgSales: slowAvg,
    salesLiftFastVsSlowPercent,
    correlationDelaySales,
    buckets,
    topAlbumsBySales,
  };
}
