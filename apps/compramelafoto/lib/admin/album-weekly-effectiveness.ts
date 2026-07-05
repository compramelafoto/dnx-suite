import type { PrismaClient } from "@prisma/client";

const TZ = "America/Argentina/Buenos_Aires";
const DEFAULT_DAYS = 90;

export type AlbumWeeklyEffectivenessRow = {
  weekStart: string;
  weekLabel: string;
  albumsSelling: number;
  albumsNotSelling: number;
  albumsWithPhotos: number;
};

function formatWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt: Intl.DateTimeFormatOptions = {
    timeZone: TZ,
    day: "numeric",
    month: "short",
  };
  const startLabel = weekStart.toLocaleDateString("es-AR", fmt);
  const endLabel = end.toLocaleDateString("es-AR", fmt);
  return `${startLabel} – ${endLabel}`;
}

/**
 * Por semana (AR, lunes como inicio): álbumes con fotos publicadas que vendieron
 * al menos una vez vs los que no registraron venta en esa semana.
 */
export async function computeAlbumWeeklyEffectiveness(
  prisma: PrismaClient,
  days = DEFAULT_DAYS
): Promise<AlbumWeeklyEffectivenessRow[]> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);

  const rows = await prisma.$queryRaw<
    Array<{
      week_start: Date;
      albums_selling: number;
      albums_not_selling: number;
      albums_with_photos: number;
    }>
  >`
    WITH week_series AS (
      SELECT generate_series(
        date_trunc(
          'week',
          timezone(${TZ}, ${cutoff}::timestamptz)
        ),
        date_trunc(
          'week',
          timezone(${TZ}, now())
        ),
        '1 week'::interval
      ) AS week_start
    ),
    album_sales AS (
      SELECT DISTINCT
        date_trunc('week', timezone(${TZ}, f."createdAt")) AS week_start,
        COALESCE(f."albumId", o."albumId") AS album_id
      FROM "FunnelVisit" f
      LEFT JOIN "Order" o ON o."id" = f."orderId"
      WHERE f."event" = 'PAYMENT_SUCCESS'
        AND f."createdAt" >= ${cutoff}
        AND COALESCE(f."albumId", o."albumId") IS NOT NULL
      UNION
      SELECT DISTINCT
        date_trunc('week', timezone(${TZ}, ord."createdAt")) AS week_start,
        ord."albumId" AS album_id
      FROM "Order" ord
      WHERE ord."status" = 'PAID'
        AND ord."isTest" = false
        AND ord."createdAt" >= ${cutoff}
    ),
    catalog_albums AS (
      SELECT
        ws.week_start,
        a."id" AS album_id
      FROM week_series ws
      INNER JOIN "Album" a ON a."deletedAt" IS NULL
      WHERE a."createdAt" < ws.week_start + interval '1 week'
        AND EXISTS (
          SELECT 1
          FROM "Photo" p
          WHERE p."albumId" = a."id"
            AND p."isRemoved" = false
            AND p."createdAt" < ws.week_start + interval '1 week'
        )
    ),
    weekly AS (
      SELECT
        ws.week_start,
        COUNT(DISTINCT CASE WHEN s.album_id IS NOT NULL THEN c.album_id END)::int AS albums_selling,
        COUNT(DISTINCT c.album_id)::int AS albums_with_photos
      FROM week_series ws
      LEFT JOIN catalog_albums c ON c.week_start = ws.week_start
      LEFT JOIN album_sales s
        ON s.week_start = ws.week_start
        AND s.album_id = c.album_id
      GROUP BY ws.week_start
    )
    SELECT
      week_start,
      albums_selling,
      GREATEST(albums_with_photos - albums_selling, 0)::int AS albums_not_selling,
      albums_with_photos
    FROM weekly
    ORDER BY week_start ASC
  `;

  return rows.map((row) => {
    const weekStart =
      row.week_start instanceof Date ? row.week_start : new Date(row.week_start);
    return {
      weekStart: weekStart.toISOString(),
      weekLabel: formatWeekLabel(weekStart),
      albumsSelling: Number(row.albums_selling),
      albumsNotSelling: Number(row.albums_not_selling),
      albumsWithPhotos: Number(row.albums_with_photos),
    };
  });
}
