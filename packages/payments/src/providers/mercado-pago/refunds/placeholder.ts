/**
 * Legacy placeholder entry — Imp 04 replaces NotImplemented with real Orders refund client.
 * Kept so existing imports resolve; prefer createMercadoPagoOrderRefund.
 */
import type { MercadoPagoHttpClient } from "../client/mercado-pago-http-client.js";
import type { MpRefundRequest, MpRefundResponse } from "./contracts.js";
import { createMercadoPagoOrderRefund } from "./client.js";
import { MercadoPagoRefundError } from "./errors.js";
import { money } from "../../../money/index.js";

/**
 * @deprecated Use createMercadoPagoOrderRefund with MercadoPagoHttpClient.
 * This wrapper cannot call MP without an http client — throws typed error.
 */
export async function createMercadoPagoRefund(
  _request: MpRefundRequest,
): Promise<MpRefundResponse> {
  throw new MercadoPagoRefundError({
    code: "REFUND_CLIENT_REQUIRED",
    message:
      "Use createMercadoPagoOrderRefund(http, input) or MercadoPagoOrdersAdapter.refund()",
  });
}

/**
 * Refund lookup is via GET /v1/orders/{id} (transactions.refunds).
 * There is no standalone GET /refunds/{id} in Orders API.
 */
export async function getMercadoPagoRefund(_refundId: string): Promise<MpRefundResponse> {
  throw new MercadoPagoRefundError({
    code: "USE_GET_ORDER",
    message:
      "Orders API has no GET refund-by-id; use getOrder and read transactions.refunds",
  });
}

/**
 * Convenience for callers that already have an http client.
 * `request.amount` must be a decimal string (e.g. "20.00") — converted via money-safe path.
 */
export async function createMercadoPagoRefundWithHttp(
  http: MercadoPagoHttpClient,
  request: MpRefundRequest,
): Promise<MpRefundResponse> {
  const result = await createMercadoPagoOrderRefund(http, {
    providerOrderId: request.order_id,
    idempotencyKey: `legacy-${request.order_id}`.slice(0, 64),
    ...(request.amount && request.transaction_id
      ? {
          amount: money(
            "ARS",
            // "20.00" → 2000 minor without floats
            (() => {
              const [w, f = ""] = request.amount.split(".");
              return BigInt(`${w}${f.padEnd(2, "0").slice(0, 2)}`);
            })(),
          ),
          providerTransactionId: request.transaction_id,
        }
      : {}),
  });
  return {
    id: result.providerRefundIds[0] ?? result.providerOrderId,
    status: result.orderStatus,
    status_detail: result.statusDetail,
    provider_refund_ids: result.providerRefundIds,
  };
}
