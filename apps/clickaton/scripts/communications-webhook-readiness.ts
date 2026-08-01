/**
 * Readiness read-only del webhook Resend (no modifica nada).
 *
 *   pnpm --filter clickaton communications:webhook:readiness
 */
import { prisma } from "@repo/db";
import { evaluateResendWebhookReadiness } from "../lib/communications/resend-webhook/readiness";

async function pingDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const tables = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'DnxCommunicationWebhookEvent'
      ) AS exists`,
    );
    const indexes = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'DnxCommunicationWebhookEvent'`,
    );
    return {
      ok: true,
      tableReady: Boolean(tables[0]?.exists),
      uniqueReady: indexes.some((i) =>
        i.indexname.includes("provider_providerEventId"),
      ),
    };
  } catch {
    return { ok: false, tableReady: false, uniqueReady: false };
  }
}

async function main() {
  const report = await evaluateResendWebhookReadiness({
    env: process.env,
    pingDatabase,
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.status === "NOT READY") process.exit(1);
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        status: "NOT READY",
        error: error instanceof Error ? error.message.slice(0, 160) : "failed",
      }),
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
