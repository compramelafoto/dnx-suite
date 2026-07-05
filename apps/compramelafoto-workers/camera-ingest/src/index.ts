import { loadEnvFiles, getConfig } from "./config.js";
import { disconnectPrisma } from "./prisma.js";
import { runProcessOnce } from "./process-camera-ingest-job.js";

loadEnvFiles();

const mode = process.argv[2] ?? "start";

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function runLoop() {
  const config = getConfig();
  const interval = config.CAMERA_INGEST_POLL_INTERVAL_MS;

  console.info("[camera-ingest-worker] starting loop", {
    intervalMs: interval,
    maxAttempts: config.CAMERA_INGEST_MAX_ATTEMPTS,
    batchConcurrency: config.CAMERA_INGEST_BATCH_CONCURRENCY,
    staleMinutes: config.CAMERA_INGEST_STALE_MINUTES,
  });

  while (true) {
    try {
      await runProcessOnce(config);
    } catch (err) {
      console.error("[camera-ingest-worker] loop error", err);
    }
    await sleep(interval);
  }
}

async function main() {
  if (mode === "process-once") {
    const config = getConfig();
    await runProcessOnce(config);
    await disconnectPrisma();
    process.exit(0);
    return;
  }

  if (mode === "start") {
    await runLoop();
    return;
  }

  console.error(`Modo desconocido: ${mode}. Usá "start" o "process-once".`);
  process.exit(1);
}

main().catch(async (err) => {
  console.error("[camera-ingest-worker] fatal", err);
  await disconnectPrisma();
  process.exit(1);
});
