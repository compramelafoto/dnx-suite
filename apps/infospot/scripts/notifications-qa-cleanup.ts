/**
 * Dry-run (default):
 *   DNX_NOTIFICATIONS_QA_ALLOW_SEED=1 pnpm --filter infospot notifications:qa-cleanup
 * Apply:
 *   DNX_NOTIFICATIONS_QA_ALLOW_SEED=1 pnpm --filter infospot notifications:qa-cleanup -- --apply
 */
import { cleanupNotificationsQa, anonymizeDbUrl } from "../lib/notifications/qa-kit";

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(
    JSON.stringify(
      {
        db: anonymizeDbUrl(process.env.DATABASE_URL || ""),
        dryRun: !apply,
      },
      null,
      2,
    ),
  );
  const report = await cleanupNotificationsQa({ dryRun: !apply });
  console.log(JSON.stringify({ ok: true, report }, null, 2));
  if (!apply) {
    console.log("Dry-run: no se borró nada. Pasá --apply para eliminar solo datos QA.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
