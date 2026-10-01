/**
 * Corre la limpieza de videos vencidos a mano, sin esperar el cron diario.
 *
 *   tsx scripts/run-video-cleanup.ts --dry-run     # informa sin borrar
 *   tsx scripts/run-video-cleanup.ts               # borra de verdad
 *   tsx scripts/run-video-cleanup.ts --max 10      # tope de videos
 *
 * Borra archivos de R2 de forma irreversible. Verificá contra qué base apunta
 * DATABASE_URL antes de correrlo.
 */
import { prisma } from "@/lib/prisma";
import { runVideoCleanup } from "@/lib/videos/video-cleanup";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const maxIdx = args.indexOf("--max");
  const maxVideos = maxIdx >= 0 ? Number(args[maxIdx + 1]) : undefined;

  console.log(dryRun ? "— MODO SECO: no se borra nada —" : "— BORRADO REAL —");

  const result = await runVideoCleanup(prisma, { dryRun, maxVideos });

  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
  process.exit(result.errores.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("fatal", err);
  await prisma.$disconnect();
  process.exit(1);
});
