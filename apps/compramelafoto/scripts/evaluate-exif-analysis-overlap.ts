/**
 * Evalúa solapamiento análisis facial/OCR vs escaneo EXIF equipos.
 * Uso: npx tsx scripts/evaluate-exif-analysis-overlap.ts
 */

import { prisma } from "@/lib/prisma";
import { pendingExifPhotoWhere } from "@/lib/photographic-equipment/pending-photos";

async function main() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalPhotos,
    exifPending,
    analysisDoneExifPending,
    bothDone,
    overlapPendingBoth,
    photosWithJob,
  ] = await Promise.all([
    prisma.photo.count({ where: { isRemoved: false } }),
    prisma.photo.count({ where: pendingExifPhotoWhere }),
    prisma.photo.count({
      where: {
        analysisJob: { status: "DONE" },
        ...pendingExifPhotoWhere,
      },
    }),
    prisma.photo.count({
      where: {
        analysisJob: { status: "DONE" },
        exifMetadataStatus: "ANALYZED",
        isRemoved: false,
      },
    }),
    prisma.photo.count({
      where: {
        ...pendingExifPhotoWhere,
        analysisJob: { status: "PENDING" },
      },
    }),
    prisma.photo.count({
      where: { isRemoved: false, analysisJob: { isNot: null } },
    }),
  ]);

  const analysisDoneByDay = await prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
    SELECT to_char(date_trunc('day', p."analyzedAt"), 'YYYY-MM-DD') AS day,
           COUNT(*)::bigint AS count
    FROM "Photo" p
    WHERE p."isRemoved" = false
      AND p."analysisStatus" = 'DONE'
      AND p."analyzedAt" >= ${thirtyDaysAgo}
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT 14
  `;

  const exifByDay = await prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
    SELECT to_char(date_trunc('day', p."exifMetadataAnalyzedAt"), 'YYYY-MM-DD') AS day,
           COUNT(*)::bigint AS count
    FROM "Photo" p
    WHERE p."isRemoved" = false
      AND p."exifMetadataAnalyzedAt" >= ${thirtyDaysAgo}
      AND p."exifMetadataStatus" IN ('ANALYZED','NO_EXIF','FAILED')
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT 14
  `;

  const analysisDoneLast7d = analysisDoneByDay
    .slice(0, 7)
    .reduce((sum, r) => sum + Number(r.count), 0);
  const exifLast7d = exifByDay.slice(0, 7).reduce((sum, r) => sum + Number(r.count), 0);

  const analysisBatch = Number(process.env.ANALYSIS_BATCH_SIZE ?? 2);
  const exifBatch = Number(process.env.EXIF_DEVICE_SCAN_BACKFILL_BATCH_SIZE ?? 100);
  const analysisRunsPerDay = (24 * 60) / 10; // cron cada 10 min
  const exifRunsPerDay = (24 * 60) / 10;

  const theoreticalAnalysisPerDay = analysisRunsPerDay * analysisBatch;
  const theoreticalExifPerDay = exifRunsPerDay * exifBatch;

  const duplicateR2ReadsAvoided = analysisDoneExifPending;
  const assumedAvgMb = 3.5; // estimación JPEG original

  console.log("=== Evaluación: unificar EXIF en pipeline de análisis ===\n");
  console.log("Fotos totales (activas):", totalPhotos.toLocaleString("es-AR"));
  console.log(
    "Con PhotoAnalysisJob:",
    `${photosWithJob.toLocaleString("es-AR")} (${((photosWithJob / totalPhotos) * 100).toFixed(1)}%)`
  );
  console.log("EXIF pendientes (elegibles):", exifPending.toLocaleString("es-AR"));
  console.log(
    "Análisis DONE pero EXIF aún pendiente:",
    duplicateR2ReadsAvoided.toLocaleString("es-AR"),
    "← ya leyeron R2 una vez para caras"
  );
  console.log("Ambos completos (análisis + EXIF):", bothDone.toLocaleString("es-AR"));
  console.log(
    "Pendientes en ambos pipelines:",
    overlapPendingBoth.toLocaleString("es-AR"),
    "← candidatas a 1 sola lectura R2"
  );

  console.log("\n--- Ritmo real últimos 7 días ---");
  console.log("Análisis completados:", analysisDoneLast7d, `(~${Math.round(analysisDoneLast7d / 7)}/día)`);
  console.log("EXIF procesados:", exifLast7d, `(~${Math.round(exifLast7d / 7)}/día)`);

  console.log("\n--- Ritmo teórico con cron cada 10 min ---");
  console.log(
    `Análisis: ${analysisBatch} fotos/lote × ${analysisRunsPerDay} runs/día ≈ ${theoreticalAnalysisPerDay}/día`
  );
  console.log(
    `EXIF: ${exifBatch} fotos/lote × ${exifRunsPerDay} runs/día ≈ ${theoreticalExifPerDay}/día`
  );

  console.log("\n--- Días para vaciar cola EXIF (56k pendientes) ---");
  const exifPerDayReal = Math.max(1, Math.round(exifLast7d / 7));
  const exifPerDayTheory = theoreticalExifPerDay;
  console.log(`Ritmo real reciente: ~${Math.ceil(exifPending / exifPerDayReal)} días`);
  console.log(`Ritmo teórico cron actual: ~${Math.ceil(exifPending / exifPerDayTheory)} días`);
  console.log(
    `Si solo pasara por análisis (${Math.round(analysisDoneLast7d / 7)}/día): ~${Math.ceil(exifPending / Math.max(1, Math.round(analysisDoneLast7d / 7)))} días`
  );

  console.log("\n--- Ahorro R2 si unificás (fotos ya analizadas sin EXIF) ---");
  const gbAvoided = (duplicateR2ReadsAvoided * assumedAvgMb) / 1024;
  console.log(
    `~${duplicateR2ReadsAvoided.toLocaleString("es-AR")} lecturas menos × ~${assumedAvgMb} MB ≈ ${gbAvoided.toFixed(1)} GB egress evitables (histórico)`
  );
  console.log(
    `En flujo nuevo: casi todas las fotos tienen job → 1 lectura R2 en vez de 2`
  );

  console.log("\n--- Costo APIs externas (NO cambia al unificar EXIF) ---");
  console.log("Google Vision OCR y AWS Rekognition: mismas llamadas que hoy.");
  console.log("EXIF (exifr + DB): costo bajo; hoy se paga aparte en el cron EXIF.");

  console.log("\n--- Últimos 14 días análisis DONE ---");
  for (const row of analysisDoneByDay) {
    console.log(`  ${row.day}: ${Number(row.count)}`);
  }
  console.log("\n--- Últimos 14 días EXIF procesado ---");
  for (const row of exifByDay) {
    console.log(`  ${row.day}: ${Number(row.count)}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
