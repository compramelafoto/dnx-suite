/**
 * Parser de notificaciones Webhook de pago (Checkout Pro / Payments API).
 * No es IPN legacy (topic=payment sin firma).
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type MercadoPagoPaymentNotification = {
  type: string;
  action: string | null;
  dataId: string;
  liveMode: boolean | null;
  apiVersion: string | null;
};

export type ParseMercadoPagoPaymentNotificationResult =
  | { ok: true; notification: MercadoPagoPaymentNotification }
  | {
      ok: false;
      code:
        | "WEBHOOK_INVALID_BODY"
        | "WEBHOOK_MISSING_DATA_ID"
        | "WEBHOOK_IGNORED_TYPE";
    };

export function extractMercadoPagoDataId(input: {
  rawBody: string;
  queryDataId?: string | null;
  queryId?: string | null;
}): string | null {
  const fromQuery = input.queryDataId?.trim() || input.queryId?.trim() || null;
  if (fromQuery) return fromQuery;

  try {
    const parsed = JSON.parse(input.rawBody) as unknown;
    if (!isRecord(parsed)) return null;
    if (isRecord(parsed.data) && parsed.data.id != null) {
      return String(parsed.data.id);
    }
    if (parsed.id != null && (parsed.type === "payment" || parsed.topic === "payment")) {
      return String(parsed.id);
    }
  } catch {
    return null;
  }
  return null;
}

export function parseMercadoPagoPaymentNotification(input: {
  rawBody: string;
  queryDataId?: string | null;
  queryType?: string | null;
  queryTopic?: string | null;
}): ParseMercadoPagoPaymentNotificationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawBody) as unknown;
  } catch {
    return { ok: false, code: "WEBHOOK_INVALID_BODY" };
  }
  if (!isRecord(parsed)) {
    return { ok: false, code: "WEBHOOK_INVALID_BODY" };
  }

  const type =
    (typeof parsed.type === "string" && parsed.type) ||
    (typeof parsed.topic === "string" && parsed.topic) ||
    input.queryType?.trim() ||
    input.queryTopic?.trim() ||
    "";

  if (!type) {
    return { ok: false, code: "WEBHOOK_INVALID_BODY" };
  }

  const isPayment =
    type === "payment" ||
    type.startsWith("payment.") ||
    type === "topic_payment";
  if (!isPayment) {
    return { ok: false, code: "WEBHOOK_IGNORED_TYPE" };
  }

  const dataId = extractMercadoPagoDataId({
    rawBody: input.rawBody,
    queryDataId: input.queryDataId,
  });
  if (!dataId) {
    return { ok: false, code: "WEBHOOK_MISSING_DATA_ID" };
  }

  const action =
    typeof parsed.action === "string"
      ? parsed.action
      : type.startsWith("payment.")
        ? type
        : null;

  return {
    ok: true,
    notification: {
      type: type.startsWith("payment") ? "payment" : type,
      action,
      dataId,
      liveMode: typeof parsed.live_mode === "boolean" ? parsed.live_mode : null,
      apiVersion: typeof parsed.api_version === "string" ? parsed.api_version : null,
    },
  };
}
