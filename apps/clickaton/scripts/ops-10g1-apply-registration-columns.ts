/**
 * Additive Production DDL for ClickatonRegistration columns required by 10F/10G.
 * Fail-closed: only ADD COLUMN IF NOT EXISTS. No drops.
 */
import { prisma } from "@repo/db";

const STATEMENTS = [
  `ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "registrationAuditIp" TEXT`,
  `ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "registrationAuditUserAgent" TEXT`,
  `ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "adultResponsibleName" TEXT`,
  `ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "adultResponsibleContact" TEXT`,
  `ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "adultAuthorizationAcceptedAt" TIMESTAMP(3)`,
  `ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "accompanimentConfirmed" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "minorLegalFieldsStatus" TEXT`,
  `ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "transferredFromRegistrationId" TEXT`,
  `ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "transferredToRegistrationId" TEXT`,
  `ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "transferCount" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "competitiveStatus" TEXT`,
  `ALTER TABLE "ClickatonRegistration" ADD COLUMN IF NOT EXISTS "competitiveValidPromptCount" INTEGER`,
];

async function main() {
  if (process.env.CONFIRM_PROD_DDL !== "1") {
    throw new Error("Set CONFIRM_PROD_DDL=1");
  }
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log("ok", sql.slice(0, 80));
  }
  console.log(JSON.stringify({ ok: true, applied: STATEMENTS.length }));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
