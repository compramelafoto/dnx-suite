/**
 * Procesa análisis face+OCR de un álbum en loop (local, contra la DB configurada).
 *
 * Uso:
 *   ANALYSIS_BATCH_SIZE=8 ANALYSIS_CONCURRENCY=3 \
 *     npx tsx scripts/process-album-analysis-loop.ts 749
 */
import { loadAnalysisEnv } from "./load-env-for-analysis";

loadAnalysisEnv();

if (!process.env.ANALYSIS_BATCH_SIZE) process.env.ANALYSIS_BATCH_SIZE = "8";
if (!process.env.ANALYSIS_CONCURRENCY) process.env.ANALYSIS_CONCURRENCY = "3";

function isDbConnectivityError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  if (code === "P1001" || code === "P1017" || code === "P2024") return true;
  const msg = String((err as Error)?.message ?? err);
  return (
    msg.includes("Can't reach database server") ||
    msg.includes("Server has closed the connection") ||
    msg.includes("Connection terminated") ||
    msg.includes("Timed out fetching a new connection") ||
    msg.includes("ECONNRESET")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const albumId = Number(process.argv[2] || "");
  const noOcr = process.argv.includes("--no-ocr");
  if (!Number.isFinite(albumId)) {
    throw new Error(
      "Uso: npx tsx scripts/process-album-analysis-loop.ts <albumId> [--no-ocr]"
    );
  }

  console.log("OCR mode:", noOcr ? "disabled" : "google→rekognition fallback");

  const { PrismaClient } = await import("@prisma/client");
  const { runAnalysisPipeline } = await import("../lib/analysis/analysis-runner");

  let prisma = new PrismaClient();
  let idleRounds = 0;
  let totalProcessed = 0;
  let totalFailed = 0;
  let round = 0;
  let dbRetries = 0;

  async function reconnectPrisma() {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    prisma = new PrismaClient();
  }

  async function unlockStuckProcessing() {
    const unlocked = await prisma.$executeRaw`
      UPDATE "PhotoAnalysisJob" j
      SET status = 'PENDING', "lockedAt" = NULL, "runAfter" = NULL, "updatedAt" = NOW()
      FROM "Photo" p
      WHERE j."photoId" = p.id
        AND p."albumId" = ${albumId}
        AND p."isRemoved" = false
        AND j.status = 'PROCESSING'
    `;
    const photos = await prisma.photo.updateMany({
      where: { albumId, isRemoved: false, analysisStatus: "PROCESSING" },
      data: { analysisStatus: "PENDING", analysisError: null },
    });
    if (Number(unlocked) > 0 || photos.count > 0) {
      console.log(`unlocked_processing jobs=${unlocked} photos=${photos.count}`);
    }
  }

  try {
    await unlockStuckProcessing();

    // Re-encolar fotos DONE sin OCR (p. ej. corridas previas sin Vision / billing)
    if (!noOcr) {
      const doneWithoutOcr = await prisma.photo.findMany({
        where: {
          albumId,
          isRemoved: false,
          analysisStatus: "DONE",
          ocrTokens: { none: {} },
        },
        select: { id: true },
      });
      if (doneWithoutOcr.length > 0) {
        console.log(`requeue_done_without_ocr=${doneWithoutOcr.length}`);
        const ids = doneWithoutOcr.map((p) => p.id);
        await prisma.photo.updateMany({
          where: { id: { in: ids } },
          data: { analysisStatus: "PENDING", analysisError: null, analyzedAt: null },
        });
        const prioritizedAt = new Date("2000-01-01T00:00:00.000Z");
        await prisma.photoAnalysisJob.updateMany({
          where: { photoId: { in: ids } },
          data: {
            status: "PENDING",
            runAfter: null,
            lockedAt: null,
            lastError: null,
            createdAt: prioritizedAt,
          },
        });
      }
    }

    while (idleRounds < 3) {
      try {
        round += 1;
        const pending = await prisma.photo.count({
          where: {
            albumId,
            isRemoved: false,
            analysisStatus: { in: ["PENDING", "PROCESSING"] },
          },
        });
        console.log(
          `[round ${round}] pending_photos=${pending} processed_so_far=${totalProcessed}`
        );
        if (pending === 0) break;

        const response = await runAnalysisPipeline({
          includeOcr: !noOcr,
          debug: false,
          source: "admin",
          albumId,
        });

        const body = await response.json().catch(() => ({}));
        const processed = Number(body.processed || 0);
        const failed = Number(body.processed_fail || 0);
        totalProcessed += processed;
        totalFailed += failed;
        console.log(`[round ${round}] result`, body);
        dbRetries = 0;

        if (processed === 0 && failed === 0) {
          idleRounds += 1;
        } else {
          idleRounds = 0;
        }
      } catch (err) {
        if (!isDbConnectivityError(err) || dbRetries >= 8) throw err;
        dbRetries += 1;
        const waitMs = Math.min(60_000, 5_000 * dbRetries);
        console.warn(
          `[round ${round}] db_connectivity_retry=${dbRetries} wait_ms=${waitMs}`,
          String((err as Error)?.message ?? err).slice(0, 200)
        );
        await sleep(waitMs);
        await reconnectPrisma();
        await unlockStuckProcessing();
      }
    }

    const groups = await prisma.photo.groupBy({
      by: ["analysisStatus"],
      where: { albumId, isRemoved: false },
      _count: { _all: true },
    });
    const faces = await prisma.faceDetection.count({
      where: { photo: { albumId, isRemoved: false } },
    });
    const ocrPhotos = await prisma.photo.count({
      where: { albumId, isRemoved: false, ocrTokens: { some: {} } },
    });
    console.log("DONE", {
      totalProcessed,
      totalFailed,
      groups,
      faces,
      ocrPhotos,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
