import type { ServerResponse } from "node:http";
import { sendJson } from "../../server/http-response.js";
import { logWarn } from "../../logger/logger.js";

export function sendLabSafeError(
  res: ServerResponse,
  status: number,
  code: string,
): void {
  logWarn("review_lab_error", { code, status });
  sendJson(res, status, {
    ok: false,
    error: code,
    message:
      "No pude procesar este turno. Reiniciá la conversación o probá nuevamente.",
  });
}
