/**
 * Read-only: verify material objects expected by selected migrations exist on DB.
 *
 * Usage:
 *   DATABASE_URL='postgresql://…' pnpm exec tsx scripts/verify-gap-objects.mts
 *
 * Refuses --allow-write. Does not print DATABASE_URL.
 */
import { PrismaClient } from "@prisma/client";

function parseArgs(argv: string[]) {
  const out: { url?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") out.url = argv[++i];
    else if (argv[i] === "--allow-write") {
      console.error("Refusing: read-only script.");
      process.exit(2);
    }
  }
  return out;
}

function sanitizeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid-url)";
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url ?? process.env.DATABASE_URL ?? process.env.AUDIT_DATABASE_URL;
  if (!url) {
    console.error("Missing URL (--url or DATABASE_URL). Does not load .env.");
    process.exit(2);
  }
  if (/neon\.tech/i.test(url)) {
    console.warn(`WARN: host=${sanitizeHost(url)} Neon — SELECT only.`);
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const checks = await prisma.$queryRaw<Array<{ key: string; ok: boolean }>>`
      SELECT * FROM (VALUES
        ('ReferralProgram_enum', EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReferralProgram')),
        ('ReferralAttribution.referralProgram', EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'ReferralAttribution' AND column_name = 'referralProgram')),
        ('FotorankExperienceType', EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FotorankExperienceType')),
        ('FotorankContest.experienceType', EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'FotorankContest' AND column_name = 'experienceType')),
        ('FotorankRegistrationPricingMode', EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'FotorankRegistrationPricingMode')),
        ('FotorankContest.registrationEnabled', EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'FotorankContest' AND column_name = 'registrationEnabled')),
        ('DnxPaymentIntent', to_regclass('public."DnxPaymentIntent"') IS NOT NULL),
        ('ClickatonEditionStatus', EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClickatonEditionStatus')),
        ('ClickatonEdition', to_regclass('public."ClickatonEdition"') IS NOT NULL),
        ('ClickatonVenue', to_regclass('public."ClickatonVenue"') IS NOT NULL),
        ('FotofficePhotographerProfile', to_regclass('public."FotofficePhotographerProfile"') IS NOT NULL),
        ('FotofficeWorkspaceBranding.onboardingCompletedAt', EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'FotofficeWorkspaceBranding' AND column_name = 'onboardingCompletedAt')),
        ('InfoSpotUserRole.lastChangedAt', EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'InfoSpotUserRole' AND column_name = 'lastChangedAt'))
      ) AS t(key, ok)
    `;

    const report = {
      host: sanitizeHost(url),
      checks: Object.fromEntries(checks.map((c) => [c.key, c.ok])),
      allOk: checks.every((c) => c.ok),
    };
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.allOk ? 0 : 1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
