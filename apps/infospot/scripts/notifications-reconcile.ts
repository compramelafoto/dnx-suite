/**
 *   pnpm --filter infospot notifications:reconcile
 *   pnpm --filter infospot notifications:reconcile -- --apply
 */
import { reconcileNotifications } from "../lib/notifications/reconcile";

async function main() {
  const apply = process.argv.includes("--apply");
  const report = await reconcileNotifications({ dryRun: !apply });
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
