import type { WebhookProcessingResult } from "@repo/communications";

export type ResendWebhookHttpBody = {
  received: boolean;
  status?: string;
};

export type ResendWebhookHttpResult = {
  status: number;
  body: ResendWebhookHttpBody;
  headers: Record<string, string>;
};

const NO_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
} as const;

/**
 * Traduce resultado del processor a HTTP seguro (sin IDs ni PII).
 */
export function mapWebhookResultToHttp(
  result: WebhookProcessingResult,
): ResendWebhookHttpResult {
  switch (result.status) {
    case "processed":
    case "ignored":
    case "duplicate":
      return {
        status: 200,
        body: { received: true, status: result.status },
        headers: { ...NO_CACHE },
      };
    case "rejected": {
      const code = result.errorCode ?? "";
      if (code === "WEBHOOK_DISABLED") {
        return {
          status: 503,
          body: { received: false, status: "disabled" },
          headers: { ...NO_CACHE },
        };
      }
      if (
        code === "WEBHOOK_SIGNATURE_MISSING" ||
        code === "WEBHOOK_SIGNATURE_INVALID" ||
        code === "WEBHOOK_SIGNATURE_EXPIRED"
      ) {
        return {
          status: 401,
          body: { received: false, status: "rejected" },
          headers: { ...NO_CACHE },
        };
      }
      return {
        status: 400,
        body: { received: false, status: "rejected" },
        headers: { ...NO_CACHE },
      };
    }
    case "failed":
    default:
      return {
        status: 500,
        body: { received: false, status: "failed" },
        headers: { ...NO_CACHE },
      };
  }
}

export function disabledEndpointResponse(
  kind: "flag_off" | "config_missing",
): ResendWebhookHttpResult {
  if (kind === "flag_off") {
    return {
      status: 404,
      body: { received: false },
      headers: { ...NO_CACHE },
    };
  }
  return {
    status: 503,
    body: { received: false, status: "misconfigured" },
    headers: { ...NO_CACHE },
  };
}

export function methodNotAllowedResponse(): ResendWebhookHttpResult {
  return {
    status: 405,
    body: { received: false, status: "method_not_allowed" },
    headers: { ...NO_CACHE, Allow: "POST" },
  };
}
