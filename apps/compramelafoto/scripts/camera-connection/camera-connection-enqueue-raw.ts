/**
 * Encola manualmente un raw ya existente en R2 (log RECEIVED + job PENDING).
 * No sube el archivo; útil para reprocesar o probar el worker sin FTP.
 *
 * Uso:
 *   npx tsx scripts/camera-connection/camera-connection-enqueue-raw.ts \
 *     --userId=1 --albumId=42 \
 *     --rawKey=albums/42/raw/abc-foto.jpg \
 *     --filename=foto.jpg \
 *     --filesizeBytes=500000
 */
import { loadCameraConnectionEnv } from "./_load-env";
import { createCameraUploadLogAndEnqueue } from "../../lib/camera-connection/create-camera-upload-log-and-enqueue";
import { getR2ObjectMetadata } from "../../lib/r2-client";

loadCameraConnectionEnv();

function requireArg(argv: string[], name: string): string {
  const arg = argv.find((a) => a.startsWith(`--${name}=`));
  const value = arg?.split("=").slice(1).join("=");
  if (!value?.trim()) {
    throw new Error(`Falta --${name}=...`);
  }
  return value.trim();
}

function optionalArgInt(argv: string[], name: string): number | undefined {
  const arg = argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return undefined;
  const value = Number.parseInt(arg.split("=")[1] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

async function main() {
  const argv = process.argv.slice(2);

  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(`
Encolar raw existente en R2 (sin FTP).

  npx tsx scripts/camera-connection/camera-connection-enqueue-raw.ts \\
    --userId=1 --albumId=42 \\
    --rawKey=albums/42/raw/uuid-foto.jpg \\
    --filename=foto.jpg \\
    [--filesizeBytes=500000] [--skip-head]
`);
    process.exit(0);
  }

  const userId = Number.parseInt(requireArg(argv, "userId"), 10);
  const albumId = Number.parseInt(requireArg(argv, "albumId"), 10);
  const rawKey = requireArg(argv, "rawKey");
  const filename = requireArg(argv, "filename");
  const skipHead = argv.includes("--skip-head");

  let filesizeBytes = optionalArgInt(argv, "filesizeBytes");
  if (!skipHead) {
    try {
      const meta = await getR2ObjectMetadata(rawKey);
      filesizeBytes = meta.size;
      console.log(`R2 HeadObject OK: ${meta.size} bytes`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️  No se pudo leer metadata R2: ${message}`);
      if (filesizeBytes == null) {
        throw new Error("Indicá --filesizeBytes o corregí rawKey / credenciales R2");
      }
    }
  }

  const result = await createCameraUploadLogAndEnqueue({
    userId,
    albumId,
    rawKey,
    filename,
    filesizeBytes: filesizeBytes ?? null,
  });

  console.log("\n✅ Encolado");
  console.log(
    JSON.stringify(
      {
        created: result.created,
        jobId: result.job.id,
        jobStatus: result.job.status,
        logId: result.log.id,
        logStatus: result.log.status,
        rawKey: result.job.rawKey,
      },
      null,
      2
    )
  );
  console.log("\nCorré camera-ingest-worker: cd camera-ingest-worker && npm run process-once\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
