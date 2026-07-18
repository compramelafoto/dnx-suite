import http from "node:http";
import { createApp } from "../app/create-app.js";
import { isReviewLabEnabled } from "../review-lab/enabled.js";
import { logError, logInfo } from "../logger/logger.js";
import type { AppDeps } from "../types/app-deps.js";

export function startServer(deps: AppDeps): http.Server {
  const handleRequest = createApp(deps);
  const reviewLab = isReviewLabEnabled();

  const server = http.createServer((req, res) => {
    void handleRequest(req, res).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      logError("request_failed", { error: message, path: req.url });
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(
          JSON.stringify({
            ok: false,
            error: "internal_error",
            service: deps.config.serviceName,
          }),
        );
      }
    });
  });

  server.listen(deps.config.port, "0.0.0.0", () => {
    const paths = ["/health", "POST /simulate/message"];
    if (reviewLab) paths.push("GET /review-lab", "POST /review-lab/api/*");
    logInfo("listening", {
      port: deps.config.port,
      environment: deps.config.environment,
      mode: deps.config.mode,
      paths,
      memory: "in-memory",
      reviewLab,
    });
  });

  return server;
}
