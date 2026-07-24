/**
 * Seed QA + storage states Playwright (Etapa 21).
 *
 *   DNX_NOTIFICATIONS_QA_ALLOW_SEED=1 pnpm --filter infospot notifications:qa-prepare-browser
 */
import { seedNotificationsQa, anonymizeDbUrl } from "../lib/notifications/qa-kit";
import { writeStorageStates } from "../lib/notifications/qa-browser-roles";

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
  const states = await writeStorageStates();
  console.log(
    JSON.stringify(
      {
        ok: true,
        photographers: manifest.photographerUserIds.length,
        events: manifest.infoSpotEventIds.length,
        storageStates: states.length,
        artifacts: "apps/infospot/.qa-artifacts (gitignored)",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
