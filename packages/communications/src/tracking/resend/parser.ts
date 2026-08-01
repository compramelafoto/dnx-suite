import { CommunicationError } from "../../shared/errors";
import {
  DEFAULT_WEBHOOK_MAX_BYTES,
  type ResendWebhookEnvelope,
} from "./types";

export type ParseResendWebhookResult =
  | { ok: true; envelope: ResendWebhookEnvelope }
  | {
      ok: false;
      errorCode:
        | "WEBHOOK_PAYLOAD_EMPTY"
        | "WEBHOOK_PAYLOAD_TOO_LARGE"
        | "WEBHOOK_JSON_INVALID"
        | "WEBHOOK_SCHEMA_INVALID";
      errorMessage: string;
    };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parser estricto: JSON + esquema mínimo.
 * No verifica firma (eso ocurre antes con body crudo).
 */
export function parseResendWebhookPayload(
  raw: string,
  options: { maxBytes?: number } = {},
): ParseResendWebhookResult {
  const maxBytes = options.maxBytes ?? DEFAULT_WEBHOOK_MAX_BYTES;
  if (raw === undefined || raw === null || raw.trim() === "") {
    return {
      ok: false,
      errorCode: "WEBHOOK_PAYLOAD_EMPTY",
      errorMessage: "Payload webhook vacío.",
    };
  }
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    return {
      ok: false,
      errorCode: "WEBHOOK_PAYLOAD_TOO_LARGE",
      errorMessage: `Payload excede el máximo de ${maxBytes} bytes.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return {
      ok: false,
      errorCode: "WEBHOOK_JSON_INVALID",
      errorMessage: "JSON inválido.",
    };
  }

  if (Array.isArray(parsed) || !isPlainObject(parsed)) {
    return {
      ok: false,
      errorCode: "WEBHOOK_SCHEMA_INVALID",
      errorMessage: "El payload debe ser un objeto JSON.",
    };
  }

  const type = parsed.type;
  if (typeof type !== "string" || !type.trim()) {
    return {
      ok: false,
      errorCode: "WEBHOOK_SCHEMA_INVALID",
      errorMessage: "Campo type ausente o inválido.",
    };
  }

  if (parsed.created_at !== undefined && typeof parsed.created_at !== "string") {
    return {
      ok: false,
      errorCode: "WEBHOOK_SCHEMA_INVALID",
      errorMessage: "Campo created_at inválido.",
    };
  }

  if (parsed.data !== undefined && !isPlainObject(parsed.data)) {
    return {
      ok: false,
      errorCode: "WEBHOOK_SCHEMA_INVALID",
      errorMessage: "Campo data debe ser un objeto cuando está presente.",
    };
  }

  const data = parsed.data as ResendWebhookEnvelope["data"];
  if (data?.email_id !== undefined && typeof data.email_id !== "string") {
    return {
      ok: false,
      errorCode: "WEBHOOK_SCHEMA_INVALID",
      errorMessage: "data.email_id inválido.",
    };
  }

  return {
    ok: true,
    envelope: {
      type: type.trim(),
      created_at:
        typeof parsed.created_at === "string" ? parsed.created_at : undefined,
      data,
    },
  };
}

export function assertValidOccurredAt(raw: string | undefined): Date {
  if (!raw?.trim()) {
    throw new CommunicationError(
      "WEBHOOK_TIMESTAMP_INVALID",
      "Timestamp de evento ausente.",
    );
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new CommunicationError(
      "WEBHOOK_TIMESTAMP_INVALID",
      "Timestamp de evento inválido.",
    );
  }
  return date;
}
