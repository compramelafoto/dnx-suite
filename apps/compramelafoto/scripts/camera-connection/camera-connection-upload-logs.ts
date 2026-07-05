/**
 * Últimos CameraUploadLog (historial Conexión de Cámara).
 *
 * Uso:
 *   npx tsx scripts/camera-connection/camera-connection-upload-logs.ts
 *   npx tsx scripts/camera-connection/camera-connection-upload-logs.ts --limit=20
 *   npx tsx scripts/camera-connection/camera-connection-upload-logs.ts --userId=42
 */
import { loadCameraConnectionEnv } from "./_load-env";
import { prisma } from "../../lib/prisma";

loadCameraConnectionEnv();

function parseArgInt(argv: string[], name: string): number | undefined {
  const arg = argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return undefined;
  const value = Number.parseInt(arg.split("=")[1] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const limit = parseArgInt(argv, "limit") ?? 15;
  const userId = parseArgInt(argv, "userId");

  const logs = await prisma.cameraUploadLog.findMany({
    where: userId != null ? { userId } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      userId: true,
      albumId: true,
      filename: true,
      filesize: true,
      status: true,
      errorMessage: true,
      createdAt: true,
      ingestJob: { select: { id: true, status: true, photoId: true } },
    },
  });

  console.log("\n=== Últimos CameraUploadLog ===");
  if (userId != null) console.log(`Filtro userId: ${userId}`);
  console.log(`Límite: ${limit}\n`);

  if (logs.length === 0) {
    console.log("  (sin registros)\n");
    return;
  }

  for (const log of logs) {
    const job = log.ingestJob;
    console.log(
      [
        `#${log.id}`,
        log.createdAt.toISOString(),
        `user=${log.userId}`,
        `album=${log.albumId ?? "-"}`,
        log.status,
        log.filename,
        log.filesize != null ? `${log.filesize}B` : "-",
      ].join(" | ")
    );
    if (log.errorMessage) {
      console.log(`    error: ${log.errorMessage}`);
    }
    if (job) {
      console.log(`    job: ${job.id} (${job.status}) photoId=${job.photoId ?? "-"}`);
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
