/**
 * Resetea jobs ZIP en estado FAILED a PENDING para que el cron los reintente.
 * Útil cuando fallaron por falta de R2 en local; en Vercel con R2 configurado funcionarán.
 *
 * Uso: npx tsx scripts/retry-failed-zip-jobs.ts
 */

import { prisma } from "../lib/prisma";

async function main() {
  const result = await prisma.zipGenerationJob.updateMany({
    where: { status: "FAILED", type: "ORDER_DOWNLOAD" },
    data: {
      status: "PENDING",
      error: null,
      startedAt: null,
      finishedAt: null,
    },
  });

  console.log(`\n${result.count} jobs reseteados a PENDING.`);
  console.log("El cron process-zip-jobs los procesará en Vercel.\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
