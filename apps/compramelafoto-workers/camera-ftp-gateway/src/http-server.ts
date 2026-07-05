import http from "node:http";
import type { GatewayConfig } from "./config.js";
import { checkReadiness } from "./ready.js";

export function startHttpServer(config: GatewayConfig, startedAtMs: number): http.Server {
  const passivePortRange = `${config.FTP_PASV_MIN_PORT}-${config.FTP_PASV_MAX_PORT}`;

  return http.createServer((req, res) => {
    const path = req.url?.split("?")[0];

    if (path === "/health" || path === "/health/") {
      const uptimeSeconds = Math.floor((Date.now() - startedAtMs) / 1000);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          service: "camera-ftp-gateway",
          uptime: uptimeSeconds,
          ftpPort: config.CAMERA_CONNECTION_FTP_PORT,
          passivePortRange,
          maxUploadBytes: config.FTP_MAX_UPLOAD_BYTES,
        })
      );
      return;
    }

    if (path === "/ready" || path === "/ready/") {
      void checkReadiness(config)
        .then((result) => {
          const statusCode = result.ready ? 200 : 503;
          res.writeHead(statusCode, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: result.ready ? "ready" : "not_ready",
              service: "camera-ftp-gateway",
              checks: result.checks,
            })
          );
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "not_ready",
              service: "camera-ftp-gateway",
              checks: [{ name: "readiness", ok: false, detail: message }],
            })
          );
        });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "not_found", service: "camera-ftp-gateway" }));
  }).listen(config.HEALTH_PORT, "0.0.0.0", () => {
    console.info("[camera-ftp-gateway] http listening", {
      port: config.HEALTH_PORT,
      paths: ["/health", "/ready"],
    });
  });
}
