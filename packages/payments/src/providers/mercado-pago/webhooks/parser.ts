import type { PaymentEnvironment } from "../../../contracts/primitives.js";
import type { NormalizedWebhook } from "../../types.js";
import { PaymentProviderValidationError } from "../../../errors/provider-errors.js";
import type { MpOrdersWebhookEnvelope } from "./contracts.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEnvelope(rawBody: string): MpOrdersWebhookEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    throw new PaymentProviderValidationError("Invalid webhook JSON body");
  }

  if (!isRecord(parsed)) {
    throw new PaymentProviderValidationError("Webhook body must be an object");
  }

  if (typeof parsed.type !== "string") {
    throw new PaymentProviderValidationError("Webhook type is required");
  }

  if (!isRecord(parsed.data) || typeof parsed.data.id !== "string") {
    throw new PaymentProviderValidationError("Webhook data.id is required");
  }

  const envelope: MpOrdersWebhookEnvelope = {
    type: parsed.type,
    data: { id: parsed.data.id as string },
  };
  if (parsed.id !== undefined && (typeof parsed.id === "string" || typeof parsed.id === "number")) {
    envelope.id = parsed.id;
  }
  if (typeof parsed.live_mode === "boolean") envelope.live_mode = parsed.live_mode;
  if (typeof parsed.date_created === "string") envelope.date_created = parsed.date_created;
  if (typeof parsed.application_id === "number") envelope.application_id = parsed.application_id;
  if (typeof parsed.user_id === "string") envelope.user_id = parsed.user_id;
  if (typeof parsed.version === "number") envelope.version = parsed.version;
  if (typeof parsed.api_version === "string") envelope.api_version = parsed.api_version;
  if (typeof parsed.action === "string") envelope.action = parsed.action;
  return envelope;
}

export async function parseMercadoPagoOrdersWebhook(
  _headers: Record<string, string | undefined>,
  rawBody: string,
  environment: PaymentEnvironment,
): Promise<NormalizedWebhook> {
  const envelope = parseEnvelope(rawBody);
  const liveMode = envelope.live_mode ?? environment === "production";
  const action = envelope.action ?? envelope.type;
  const eventKey = `orders_v1:${envelope.type}:${envelope.data.id}:${action}`;

  return {
    eventKey,
    providerOrderId: envelope.data.id,
    action,
    liveMode,
  };
}
