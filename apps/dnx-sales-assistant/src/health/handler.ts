import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppConfig } from "../types/config.js";
import type { HealthResponse } from "../types/health.js";
import { sendJson } from "../server/http-response.js";

export function createHealthHandler(config: AppConfig) {
  return (_req: IncomingMessage, res: ServerResponse): void => {
    const body: HealthResponse = {
      ok: true,
      service: "dnx-sales-assistant",
      version: config.version,
      environment: config.environment,
      timestamp: new Date().toISOString(),
    };
    sendJson(res, 200, body);
  };
}
