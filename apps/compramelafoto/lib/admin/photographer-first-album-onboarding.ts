import type { PrismaClient } from "@prisma/client";

const TZ = "America/Argentina/Buenos_Aires";
const DEFAULT_LOOKBACK_DAYS = 90;

export type PhotographerFirstAlbumOnboardingRow = {
  photographerId: number;
  name: string | null;
  email: string;
  firstAlbumId: number;
  firstAlbumTitle: string;
  firstAlbumUploadedAt: string;
  albumCount: number;
  hasSaleThisWeek: boolean;
  salesThisWeekAmount: number;
};

/**
 * Fotógrafos cuya primera carga de fotos en un álbum ocurrió en los últimos N días.
 * Incluye si tuvieron ventas PAID en la semana calendario actual (Argentina).
 */
export async function computePhotographerFirstAlbumOnboarding(
  prisma: PrismaClient,
  lookbackDays = DEFAULT_LOOKBACK_DAYS
): Promise<PhotographerFirstAlbumOnboardingRow[]> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - lookbackDays);

  const rows = await prisma.$queryRaw<
    Array<{
      photographer_id: number;
      name: string | null;
      email: string;
      first_album_id: number;
      first_album_title: string;
      first_album_uploaded_at: Date;
      album_count: number;
      sales_this_week_amount: number | bigint;
    }>
  >`
    WITH album_uploads AS (
      SELECT
        a."userId" AS photographer_id,
        a.id AS album_id,
        a.title AS album_title,
        COALESCE(
          a."firstPhotoDate",
          (
            SELECT MIN(p."createdAt")
            FROM "Photo" p
            WHERE p."albumId" = a.id
              AND p."isRemoved" = false
          )
        ) AS first_upload_at
      FROM "Album" a
      WHERE a."deletedAt" IS NULL
        AND a."isTest" = false
        AND EXISTS (
          SELECT 1
          FROM "Photo" p
          WHERE p."albumId" = a.id
            AND p."isRemoved" = false
        )
    ),
    photographer_first AS (
      SELECT DISTINCT ON (au.photographer_id)
        au.photographer_id,
        au.album_id AS first_album_id,
        au.album_title AS first_album_title,
        au.first_upload_at AS first_album_uploaded_at
      FROM album_uploads au
      WHERE au.first_upload_at IS NOT NULL
      ORDER BY au.photographer_id, au.first_upload_at ASC
    ),
    album_counts AS (
      SELECT
        a."userId" AS photographer_id,
        COUNT(*)::int AS album_count
      FROM "Album" a
      WHERE a."deletedAt" IS NULL
        AND a."isTest" = false
        AND EXISTS (
          SELECT 1
          FROM "Photo" p
          WHERE p."albumId" = a.id
            AND p."isRemoved" = false
        )
      GROUP BY a."userId"
    ),
    week_sales AS (
      SELECT
        s.photographer_id,
        COALESCE(SUM(s.amount), 0)::bigint AS sales_this_week_amount
      FROM (
        SELECT
          a."userId" AS photographer_id,
          o."totalCents"::bigint AS amount
        FROM "Order" o
        INNER JOIN "Album" a ON a.id = o."albumId"
        WHERE o.status = 'PAID'
          AND o."isTest" = false
          AND date_trunc('week', timezone(${TZ}, o."createdAt"))
            = date_trunc('week', timezone(${TZ}, now()))

        UNION ALL

        SELECT
          po."photographerId" AS photographer_id,
          po."total"::bigint AS amount
        FROM "PrintOrder" po
        WHERE po."paymentStatus" = 'PAID'
          AND po."photographerId" IS NOT NULL
          AND date_trunc('week', timezone(${TZ}, po."createdAt"))
            = date_trunc('week', timezone(${TZ}, now()))
      ) s
      GROUP BY s.photographer_id
    )
    SELECT
      pf.photographer_id,
      u.name,
      u.email,
      pf.first_album_id,
      pf.first_album_title,
      pf.first_album_uploaded_at,
      COALESCE(ac.album_count, 0) AS album_count,
      COALESCE(ws.sales_this_week_amount, 0) AS sales_this_week_amount
    FROM photographer_first pf
    INNER JOIN "User" u ON u.id = pf.photographer_id
    LEFT JOIN album_counts ac ON ac.photographer_id = pf.photographer_id
    LEFT JOIN week_sales ws ON ws.photographer_id = pf.photographer_id
    WHERE u.role IN ('PHOTOGRAPHER', 'LAB_PHOTOGRAPHER')
      AND pf.first_album_uploaded_at >= ${cutoff}
    ORDER BY pf.first_album_uploaded_at DESC
    LIMIT 200
  `;

  return rows.map((row) => {
    const salesThisWeekAmount = Number(row.sales_this_week_amount);
    const uploadedAt =
      row.first_album_uploaded_at instanceof Date
        ? row.first_album_uploaded_at
        : new Date(row.first_album_uploaded_at);

    return {
      photographerId: row.photographer_id,
      name: row.name,
      email: row.email,
      firstAlbumId: row.first_album_id,
      firstAlbumTitle: row.first_album_title,
      firstAlbumUploadedAt: uploadedAt.toISOString(),
      albumCount: Number(row.album_count),
      hasSaleThisWeek: salesThisWeekAmount > 0,
      salesThisWeekAmount,
    };
  });
}
