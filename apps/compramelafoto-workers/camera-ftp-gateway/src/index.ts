import { loadEnvFiles, getConfig } from "./config.js";
import { createFtpServer } from "./create-ftp-server.js";
import { startHttpServer } from "./http-server.js";
import { logInfo, logWarn } from "./logger.js";
import { disconnectPrisma } from "./prisma.js";

loadEnvFiles();

async function main() {
  const config = getConfig();
  const startedAtMs = Date.now();

  if (!config.pasvUrl) {
    logWarn("pasv_url_missing", {
      status: "warning",
      detail: "FTP_PASV_URL no configurado; modo pasivo puede fallar",
    });
  }

  const httpServer = startHttpServer(config, startedAtMs);
  const ftpServer = createFtpServer(config);

  await ftpServer.listen();

  logInfo("ftp_listening", {
    status: "ok",
    ftpPort: config.CAMERA_CONNECTION_FTP_PORT,
    passivePortRange: `${config.FTP_PASV_MIN_PORT}-${config.FTP_PASV_MAX_PORT}`,
    maxUploadBytes: config.FTP_MAX_UPLOAD_BYTES,
    rateLimit: {
      windowMs: config.FTP_RATE_LIMIT_WINDOW_MS,
      maxFiles: config.FTP_RATE_LIMIT_MAX_FILES,
    },
    pasvUrl: config.pasvUrl ?? null,
  });

  const shutdown = async (signal: string) => {
    logInfo("shutting_down", { status: "stopping", signal });
    httpServer.close();
    await ftpServer.close();
    await disconnectPrisma();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch(async (err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[camera-ftp-gateway] fatal", { status: "fatal", error: message });
  await disconnectPrisma();
  process.exit(1);
});
