/**
 * Resumen de CameraIngestJob por estado (PENDING, PROCESSING, FAILED, …).
 *
 * Uso:
 *   npx tsx scripts/camera-connection/camera-connection-ingest-jobs-status.ts
 *   npx tsx scripts/camera-connection/camera-connection-ingest-jobs-status.ts --userId=42
 */
import { loadCameraConnectionEnv } from "./_load-env";
import { prisma } from "../../lib/prisma";

loadCameraConnectionEnv();

function parseUserId(argv: string[]): number | undefined {
  const arg = argv.find((a) => a.startsWith("--userId="));
  if (!arg) return undefined;
  const value = Number.parseInt(arg.split("=")[1] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

async function main() {
  const userId = parseUserId(process.argv.slice(2));
  const where = userId != null ? { userId } : {};

  const grouped = await prisma.cameraIngestJob.groupBy({
    by: ["status"],
    where,
    _count: { _all: true },
  });

  const oldestPending = await prisma.cameraIngestJob.findFirst({
    where: { ...where, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true, createdAt: true, rawKey: true, attempts: true },
  });

  const recentFailed = await prisma.cameraIngestJob.findMany({
    where: { ...where, status: "FAILED" },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      rawKey: true,
      lastError: true,
      attempts: true,
      updatedAt: true,
    },
  });

  console.log("\n=== CameraIngestJob por estado ===");
  if (userId != null) console.log(`Filtro userId: ${userId}`);
  console.log("");

  const order = ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] as const;
  const map = new Map(grouped.map((g) => [g.status, g._count._all]));

  for (const status of order) {
    console.log(`  ${status.padEnd(12)} ${map.get(status) ?? 0}`);
  }

  const other = grouped.filter((g) => !order.includes(g.status as (typeof order)[number]));
  for (const row of other) {
    console.log(`  ${row.status.padEnd(12)} ${row._count._all}`);
  }

  const pending = map.get("PENDING") ?? 0;
  if (pending > 0 && oldestPending) {
    console.log("\n--- PENDING más antiguo ---");
    console.log(JSON.stringify(oldestPending, null, 2));
  }

  if (recentFailed.length > 0) {
    console.log("\n--- Últimos FAILED (máx. 5) ---");
    for (const job of recentFailed) {
      console.log(
        `  ${job.id} | ${job.updatedAt.toISOString()} | attempts=${job.attempts} | ${job.lastError?.slice(0, 80) ?? ""}`
      );
      console.log(`    rawKey: ${job.rawKey}`);
    }
  }

  console.log("");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
