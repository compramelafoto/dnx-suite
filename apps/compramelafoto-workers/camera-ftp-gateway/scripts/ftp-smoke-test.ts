/**
 * Smoke test: sube un JPG al gateway FTP con basic-ftp.
 *
 * Requiere:
 * - Gateway corriendo (npm run start)
 * - FTP_HOST, FTP_USER, FTP_PASS en env
 * - FTP_SMOKE_FILE apuntando a un .jpg válido
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Client } from "basic-ftp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, ".env.local"), override: true });
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

async function main() {
  const host = process.env.FTP_HOST?.trim() || "127.0.0.1";
  const port = Number.parseInt(process.env.FTP_PORT?.trim() || process.env.CAMERA_CONNECTION_FTP_PORT || "21", 10);
  const user = process.env.FTP_USER?.trim();
  const password = process.env.FTP_PASS ?? process.env.FTP_PASSWORD ?? "";
  const localFile =
    process.env.FTP_SMOKE_FILE?.trim() ||
    path.resolve(__dirname, "../test-fixtures/sample.jpg");

  if (!user) {
    console.error("FTP_USER es obligatorio");
    process.exit(1);
  }

  await fs.access(localFile);

  const client = new Client(60_000);
  client.ftp.verbose = process.env.FTP_VERBOSE === "1";

  try {
    console.info("[ftp-smoke-test] connecting", { host, port, user });
    await client.access({
      host,
      port,
      user,
      password,
      secure: false,
    });

    const remoteName = path.basename(localFile);
    console.info("[ftp-smoke-test] uploading", { localFile, remoteName });
    await client.uploadFrom(localFile, remoteName);

    console.info("[ftp-smoke-test] OK — archivo subido. Verificá CameraIngestJob en DB.");
  } catch (err) {
    console.error("[ftp-smoke-test] FAILED", err);
    process.exitCode = 1;
  } finally {
    client.close();
  }
}

main();
