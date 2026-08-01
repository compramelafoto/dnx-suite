/**
 * Readiness read-only del webhook Resend.
 *
 * Staging go-live (default):
 *   COMMUNICATIONS_STAGING_DATABASE_URL="…" \
 *   pnpm --filter clickaton communications:webhook:readiness
 *
 * Modos:
 *   --mode=staging_explicit  (default) — exige URL staging; NO usa DATABASE_URL
 *   --mode=remote_health     — no consulta DB local
 *   --mode=local             — diagnóstico local (nunca READY para go-live)
 */
import {
  evaluateResendWebhookReadiness,
  type ReadinessDbMode,
} from "../lib/communications/resend-webhook/readiness";

function parseMode(argv: string[]): ReadinessDbMode {
  const flag = argv.find((a) => a.startsWith("--mode="));
  const raw = (flag?.slice("--mode=".length) ?? "staging_explicit").toLowerCase();
  if (raw === "local" || raw === "remote_health" || raw === "staging_explicit") {
    return raw;
  }
  return "staging_explicit";
}

type PrismaLike = {
  $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  $queryRawUnsafe: <T>(query: string) => Promise<T>;
  $disconnect: () => Promise<void>;
};

async function createPrisma(url: string): Promise<PrismaLike> {
  // Clickatón resuelve @prisma/client como namespace; el ctor vive en default o named.
  const mod = (await import("@prisma/client")) as {
    PrismaClient?: new (args: { datasources: { db: { url: string } } }) => PrismaLike;
    default?: {
      PrismaClient?: new (args: { datasources: { db: { url: string } } }) => PrismaLike;
    };
  };
  const Ctor = mod.PrismaClient ?? mod.default?.PrismaClient;
  if (!Ctor) {
    throw new Error("PrismaClient_export_unavailable");
  }
  return new Ctor({ datasources: { db: { url } } });
}

async function pingWithUrl(url: string) {
  const prisma = await createPrisma(url);
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
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

async function main() {
  const dbMode = parseMode(process.argv.slice(2));
  const stagingUrl = process.env.COMMUNICATIONS_STAGING_DATABASE_URL?.trim() ?? "";

  let pingDatabase: (() => Promise<{
    ok: boolean;
    tableReady?: boolean;
    uniqueReady?: boolean;
  }>) | undefined;

  if (dbMode === "staging_explicit") {
    if (stagingUrl) {
      pingDatabase = () => pingWithUrl(stagingUrl);
    }
  } else if (dbMode === "local") {
    // Explícitamente local — no usar para go-live. Solo si el operador lo pide.
    const { prisma } = await import("@repo/db");
    pingDatabase = async () => {
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
    };
  }
  // remote_health: sin ping local

  const report = await evaluateResendWebhookReadiness({
    env: process.env,
    dbMode,
    pingDatabase,
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.status === "NOT READY") process.exit(1);
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      status: "NOT READY",
      error: error instanceof Error ? error.message.slice(0, 160) : "failed",
    }),
  );
  process.exit(1);
});
