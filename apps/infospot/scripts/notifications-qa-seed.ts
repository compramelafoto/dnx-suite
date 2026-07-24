/**
 *   DNX_NOTIFICATIONS_QA_ALLOW_SEED=1 pnpm --filter infospot notifications:qa-seed
 */
import { seedNotificationsQa, anonymizeDbUrl } from "../lib/notifications/qa-kit";

async function main() {
  console.log(
    JSON.stringify(
      {
        db: anonymizeDbUrl(process.env.DATABASE_URL || ""),
        nodeEnv: process.env.NODE_ENV || null,
      },
      null,
      2,
    ),
  );
  const manifest = await seedNotificationsQa();
  console.log(JSON.stringify({ ok: true, manifest }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
