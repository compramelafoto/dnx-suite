/**
 * Script operativo: expirar reservas públicas vencidas.
 * Por defecto dry-run. Escritura solo con --apply.
 * Solo localhost. No Neon.
 */
import { execSync } from "node:child_process";
import { userInfo } from "node:os";
import { createExpirePendingRegistrationsUseCase } from "../lib/public-registration/application/expire-pending-registrations";
import { createPrismaPublicRegistrationRepository } from "../lib/public-registration/infrastructure/prisma-public-registration-repository";

function sanitizeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "(invalid)";
  }
}

function assertLocalDatabaseUrl(url: string): void {
  const host = sanitizeHost(url).toLowerCase();
  if (host.includes("neon.tech") || host.includes("amazonaws.com")) {
    console.error(`ABORT: host remoto/Neon bloqueado (${sanitizeHost(url)}).`);
    process.exit(2);
  }
  if (!host.includes("127.0.0.1") && !host.includes("localhost")) {
    console.error(`ABORT: solo localhost permitido (host=${sanitizeHost(url)}).`);
    process.exit(2);
  }
}

function parseArgs(argv: string[]) {
  let dryRun = true;
  let limit = 50;
  let now: Date | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--apply") dryRun = false;
    if (a === "--dry-run") dryRun = true;
    if (a === "--limit") {
      limit = Number(argv[++i]);
    }
    if (a === "--now") {
      now = new Date(argv[++i]!);
    }
  }
  if (!Number.isFinite(limit) || limit < 1) limit = 50;
  if (now && Number.isNaN(now.getTime())) {
    console.error("ABORT: --now inválido");
    process.exit(2);
  }
  return { dryRun, limit, now };
}

async function main() {
  const { dryRun, limit, now } = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("ABORT: DATABASE_URL requerido");
    process.exit(2);
  }
  assertLocalDatabaseUrl(url);
  console.log(`expire-holds host=${sanitizeHost(url)} dryRun=${dryRun} limit=${limit}`);

  const repo = createPrismaPublicRegistrationRepository();
  const useCase = createExpirePendingRegistrationsUseCase({ repo });
  const result = await useCase.execute({ dryRun, limit, now });

  console.log(
    JSON.stringify(
      {
        scanned: result.scanned,
        expired: result.expired,
        skipped: result.skipped,
        failed: result.failed,
        releasedCapacityHolds: result.releasedCapacityHolds,
        releasedStockHolds: result.releasedStockHolds,
        errorCount: result.errors.length,
        dryRun: result.dryRun,
      },
      null,
      2,
    ),
  );

  if (result.failed > 0) process.exit(1);
}

/** Helper: crear DB local descartable (opcional, no se invoca solo). */
export function ensureLocalDisposableDb(dbName: string): string {
  const user = userInfo().username || "postgres";
  const url = `postgresql://${user}@127.0.0.1:5432/${dbName}?schema=public`;
  assertLocalDatabaseUrl(url);
  try {
    execSync(`createdb -h 127.0.0.1 -p 5432 ${dbName}`, { stdio: "ignore" });
  } catch {
    /* exists */
  }
  return url;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "unexpected");
  process.exit(1);
});
