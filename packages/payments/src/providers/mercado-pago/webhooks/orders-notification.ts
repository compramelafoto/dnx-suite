/**
 * Classify Mercado Pago Orders webhook envelopes (type=order / order.*).
 * Sync helper for HTTP edge + observe pipeline.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type MercadoPagoOrdersNotification = {
  type: string;
  action: string | null;
  dataId: string;
  liveMode: boolean | null;
  apiVersion: string | null;
  userIdPrefix: string | null;
};

export type ParseMercadoPagoOrdersNotificationResult =
  | { ok: true; notification: MercadoPagoOrdersNotification }
  | {
      ok: false;
      code:
        | "WEBHOOK_INVALID_BODY"
        | "WEBHOOK_MISSING_DATA_ID"
        | "WEBHOOK_IGNORED_TYPE";
    };

export function isMercadoPagoOrdersWebhookType(type: string): boolean {
  const t = type.trim().toLowerCase();
  return t === "order" || t.startsWith("order.");
}

export function parseMercadoPagoOrdersNotification(input: {
  rawBody: string;
  queryDataId?: string | null;
  queryType?: string | null;
}): ParseMercadoPagoOrdersNotificationResult {
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
    input.queryType?.trim() ||
    "";
  if (!type) {
    return { ok: false, code: "WEBHOOK_INVALID_BODY" };
  }
  if (!isMercadoPagoOrdersWebhookType(type)) {
    return { ok: false, code: "WEBHOOK_IGNORED_TYPE" };
  }

  const fromQuery = input.queryDataId?.trim() || null;
  let dataId = fromQuery;
  if (!dataId && isRecord(parsed.data) && parsed.data.id != null) {
    dataId = String(parsed.data.id);
  }
  if (!dataId) {
    return { ok: false, code: "WEBHOOK_MISSING_DATA_ID" };
  }

  const action =
    typeof parsed.action === "string"
      ? parsed.action
      : type.startsWith("order.")
        ? type
        : null;

  const userId =
    typeof parsed.user_id === "string"
      ? parsed.user_id
      : typeof parsed.user_id === "number"
        ? String(parsed.user_id)
        : null;

  return {
    ok: true,
    notification: {
      type: type.startsWith("order") ? type : "order",
      action,
      dataId,
      liveMode: typeof parsed.live_mode === "boolean" ? parsed.live_mode : null,
      apiVersion: typeof parsed.api_version === "string" ? parsed.api_version : null,
      userIdPrefix: userId ? `${userId.slice(0, 8)}…` : null,
    },
  };
}

export function buildOrdersWebhookEventId(input: {
  requestId: string;
  providerOrderId: string;
  action: string | null;
}): string {
  const action = input.action ?? "order";
  return `mp_ord_wh_${input.requestId.slice(0, 40)}_${input.providerOrderId}_${action}`.slice(
    0,
    180,
  );
}
