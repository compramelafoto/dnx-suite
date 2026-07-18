import type { IncomingMessage as HttpIncomingMessage } from "node:http";
import { JsonBodyError, readJsonBody } from "../server/read-json-body.js";
import type { AssistantRequest } from "../models/assistant.js";
import type { SimulateMessageErrorCode, SimulateValidationIssue } from "../types/simulate.js";
import { mapZodIssuesToDetails } from "./error-response.js";
import { simulateMessageRequestSchema } from "./schema.js";

export type ParseSimulateRequestResult =
  | { ok: true; request: AssistantRequest }
  | {
      ok: false;
      statusCode: number;
      error: SimulateMessageErrorCode;
      details?: SimulateValidationIssue[];
    };

function isJsonContentType(req: HttpIncomingMessage): boolean {
  const raw = req.headers["content-type"];
  if (!raw) return false;
  const mediaType = raw.split(";")[0]?.trim().toLowerCase();
  return mediaType === "application/json";
}

/**
 * Capa HTTP → AssistantRequest.
 * Validación de transporte/schema; sin lógica de conversación.
 */
export async function parseSimulateMessageRequest(
  req: HttpIncomingMessage,
): Promise<ParseSimulateRequestResult> {
  if (!isJsonContentType(req)) {
    return { ok: false, statusCode: 415, error: "unsupported_media_type" };
  }

  let rawBody: unknown;

  try {
    rawBody = await readJsonBody(req);
  } catch (err: unknown) {
    if (err instanceof JsonBodyError) {
      return {
        ok: false,
        statusCode: err.code === "payload_too_large" ? 413 : 400,
        error: err.code,
      };
    }
    return { ok: false, statusCode: 400, error: "invalid_json" };
  }

  const parsed = simulateMessageRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return {
      ok: false,
      statusCode: 400,
      error: "validation_error",
      details: mapZodIssuesToDetails(parsed.error.issues),
    };
  }

  const request: AssistantRequest = {
    message: {
      from: parsed.data.from,
      text: parsed.data.message,
      channel: "simulate",
      receivedAt: new Date().toISOString(),
    },
  };

  return { ok: true, request };
}
