/**
 * Verifica actividad del cron EXIF en producción.
 * Uso: npx tsx scripts/check-exif-cron-status.ts
 */

import { prisma } from "@/lib/prisma";
import { pendingExifPhotoWhere } from "@/lib/photographic-equipment/pending-photos";

async function main() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const [scanState, pending, exifLast24h, exifLastHour] = await Promise.all([
    prisma.exifDeviceScanState.findFirst({
      orderBy: { id: "desc" },
      select: {
        mode: true,
        isBackfillComplete: true,
        pendingCount: true,
        lastRunAt: true,
        lastBatchProcessed: true,
        lastBatchAnalyzed: true,
        processedTotal: true,
        failedTotal: true,
        analyzedTotal: true,
        currentLockId: true,
        lockExpiresAt: true,
        updatedAt: true,
      },
    }),
    prisma.photo.count({ where: pendingExifPhotoWhere }),
    prisma.photo.count({
      where: {
        isRemoved: false,
        exifMetadataAnalyzedAt: { gte: oneDayAgo },
        exifMetadataStatus: { in: ["ANALYZED", "NO_EXIF", "FAILED"] },
      },
    }),
    prisma.photo.count({
      where: {
        isRemoved: false,
        exifMetadataAnalyzedAt: { gte: oneHourAgo },
        exifMetadataStatus: { in: ["ANALYZED", "NO_EXIF", "FAILED"] },
      },
    }),
  ]);

  const byHour = await prisma.$queryRaw<Array<{ hour: string; count: bigint }>>`
    SELECT to_char(date_trunc('hour', p."exifMetadataAnalyzedAt"), 'YYYY-MM-DD HH24:00') AS hour,
           COUNT(*)::bigint AS count
    FROM "Photo" p
    WHERE p."isRemoved" = false
      AND p."exifMetadataAnalyzedAt" >= ${oneDayAgo}
      AND p."exifMetadataStatus" IN ('ANALYZED','NO_EXIF','FAILED')
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT 12
  `;

  console.log(
    JSON.stringify(
      {
        scanState,
        pendingReal: pending,
        pendingInState: scanState?.pendingCount ?? null,
        exifProcessedLast24h: exifLast24h,
        exifProcessedLastHour: exifLastHour,
        byHour: byHour.map((r) => ({ hour: r.hour, count: Number(r.count) })),
        cronLikelyRunning:
          exifLastHour > 0 ||
          Boolean(scanState?.lastRunAt && scanState.lastRunAt > oneHourAgo),
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
