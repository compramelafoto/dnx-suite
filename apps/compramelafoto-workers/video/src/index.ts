import { loadEnvFiles, getConfig } from "./config.js";
import { disconnectPrisma } from "./prisma.js";
import { runProcessOnce } from "./process-video-job.js";

loadEnvFiles();

const mode = process.argv[2] ?? "start";

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function runLoop() {
  const config = getConfig();
  const interval = config.VIDEO_WORKER_POLL_INTERVAL_MS;

  console.info("[video-worker] starting loop", {
    intervalMs: interval,
    maxAttempts: config.VIDEO_WORKER_MAX_ATTEMPTS,
  });

  while (true) {
    try {
      await runProcessOnce(config);
    } catch (err) {
      console.error("[video-worker] loop error", err);
    }
    await sleep(interval);
  }
}

/**
 * Procesa la cola hasta vaciarla (o hasta el tope) y termina.
 *
 * Es el modo para ejecución efímera: Cloud Run Job o GitHub Actions levantan el
 * contenedor, drena lo que haya y se apaga. No hay máquina encendida esperando.
 */
async function runDrain() {
  const config = getConfig();
  const max = config.VIDEO_WORKER_DRAIN_MAX;

  console.info("[video-worker] drain start", { max });

  let processed = 0;
  while (processed < max) {
    const ran = await runProcessOnce(config);
    if (!ran) break;
    processed += 1;
  }

  const drained = processed < max;
  console.info("[video-worker] drain done", { processed, max, queueEmpty: drained });
  await disconnectPrisma();
  process.exit(0);
}

async function main() {
  if (mode === "process-once") {
    const config = getConfig();
    const ran = await runProcessOnce(config);
    await disconnectPrisma();
    process.exit(ran ? 0 : 0);
    return;
  }

  if (mode === "drain") {
    await runDrain();
    return;
  }

  if (mode === "start") {
    await runLoop();
    return;
  }

  console.error(`Modo desconocido: ${mode}. Usá "start", "drain" o "process-once".`);
  process.exit(1);
}

main().catch(async (err) => {
  console.error("[video-worker] fatal", err);
  await disconnectPrisma();
  process.exit(1);
});
