/**
 * CLI worker outbox.
 *   pnpm --filter infospot notifications:worker
 */
import { runNotificationWorker } from "../lib/notifications/worker";

async function main() {
  const batch = Number(process.env.DNX_NOTIFICATIONS_BATCH || "25");
  const result = await runNotificationWorker({
    batchSize: Number.isFinite(batch) ? batch : 25,
  });
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
