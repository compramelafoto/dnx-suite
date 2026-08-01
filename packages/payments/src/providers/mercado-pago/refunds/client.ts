import type { Money } from "../../../money/types.js";
import { moneyToMercadoPagoAmount } from "../money-mapper.js";
import type { MercadoPagoHttpClient } from "../client/mercado-pago-http-client.js";
import type {
  MpOrderRefundEntry,
  MpOrderRefundRequestBody,
  MpOrderRefundResponse,
} from "./contracts.js";
import { mapMercadoPagoRefundHttpError, MercadoPagoRefundError } from "./errors.js";

export type CreateMercadoPagoOrderRefundInput = {
  providerOrderId: string;
  idempotencyKey: string;
  /**
   * Omit for total refund.
   * For partial: amount + providerTransactionId required by MP Orders API.
   */
  amount?: Money;
  providerTransactionId?: string;
};

export type CreateMercadoPagoOrderRefundResult = {
  providerOrderId: string;
  orderStatus: string;
  statusDetail?: string;
  providerRefundIds: string[];
  refundedAmountMinor: bigint | null;
  rawSanitized: Record<string, unknown>;
};

function sanitizeRefundResponse(body: MpOrderRefundResponse): Record<string, unknown> {
  const refunds: MpOrderRefundEntry[] = body.transactions?.refunds ?? [];
  return {
    providerOrderIdPrefix:
      body.id.length > 10 ? `${body.id.slice(0, 10)}…` : body.id,
    status: body.status,
    statusDetail: body.status_detail ?? null,
    refundCount: refunds.length,
    providerRefundIdPrefixes: refunds.map((r: MpOrderRefundEntry) =>
      r.id.length > 10 ? `${r.id.slice(0, 10)}…` : r.id,
    ),
    refundAmounts: refunds.map((r: MpOrderRefundEntry) => r.amount ?? null),
    refundStatuses: refunds.map((r: MpOrderRefundEntry) => r.status ?? null),
  };
}

function buildBody(
  input: CreateMercadoPagoOrderRefundInput,
): MpOrderRefundRequestBody | undefined {
  if (!input.amount) {
    // Total refund — empty body per MP docs
    return undefined;
  }
  if (!input.providerTransactionId?.trim()) {
    throw new MercadoPagoRefundError({
      code: "TRANSACTION_ID_REQUIRED",
      message:
        "Partial Orders refund requires providerTransactionId (payment transaction id)",
    });
  }
  if (input.amount.amountMinor <= 0n) {
    throw new MercadoPagoRefundError({
      code: "INVALID_REFUND_AMOUNT",
      message: "Partial refund amount must be > 0",
    });
  }
  return {
    transactions: [
      {
        id: input.providerTransactionId.trim(),
        amount: moneyToMercadoPagoAmount(input.amount),
      },
    ],
  };
}

/**
 * Official Orders API refund.
 * Sandbox write guards enforced by MercadoPagoHttpClient.
 */
export async function createMercadoPagoOrderRefund(
  http: MercadoPagoHttpClient,
  input: CreateMercadoPagoOrderRefundInput,
): Promise<CreateMercadoPagoOrderRefundResult> {
  const orderId = input.providerOrderId.trim();
  if (!orderId) {
    throw new MercadoPagoRefundError({
      code: "ORDER_ID_REQUIRED",
      message: "providerOrderId is required",
    });
  }
  const key = input.idempotencyKey.trim();
  if (!key || key.length > 64) {
    throw new MercadoPagoRefundError({
      code: "INVALID_IDEMPOTENCY_KEY",
      message: "X-Idempotency-Key must be 1..64 characters",
    });
  }

  const body = buildBody(input);
  const maxAttempts = 4;
  let response: Awaited<ReturnType<typeof http.request<MpOrderRefundResponse>>> | null =
    null;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      response = await http.request<MpOrderRefundResponse>({
        method: "POST",
        path: `/v1/orders/${orderId}/refund`,
        ...(body ? { body } : { emptyBody: true }),
        idempotencyKey: key,
      });
      break;
    } catch (err) {
      lastErr = err;
      const statusCode =
        err instanceof Error && "statusCode" in err
          ? Number((err as { statusCode?: number }).statusCode)
          : NaN;
      const retryable =
        statusCode === 422 ||
        statusCode === 429 ||
        statusCode === 423 ||
        (err instanceof Error &&
          /too_many_requests|post processing rejected|movement limit/i.test(
            err.message,
          ));
      if (!retryable || attempt >= maxAttempts - 1) {
        throw err;
      }
      // Sandbox movement limits / eventual consistency (Imp 05)
      await new Promise((r) => setTimeout(r, 5_000 * (attempt + 1)));
    }
  }

  if (!response) {
    throw lastErr instanceof Error
      ? lastErr
      : new MercadoPagoRefundError({
          code: "REFUND_FAILED",
          message: "refund_failed",
        });
  }

  if (response.status < 200 || response.status >= 300 || !response.body?.id) {
    const errBody = response.body as unknown as {
      errors?: Array<{ code?: string; message?: string }>;
    } | null;
    const first = errBody?.errors?.[0];
    throw mapMercadoPagoRefundHttpError({
      statusCode: response.status,
      title: first?.code ?? response.problem?.title ?? null,
      detail:
        first?.message ?? response.problem?.detail ?? "refund_failed",
    });
  }

  const refunds: MpOrderRefundEntry[] = response.body.transactions?.refunds ?? [];
  const providerRefundIds = refunds
    .map((r: MpOrderRefundEntry) => r.id)
    .filter(Boolean);
  const primaryRefundId = providerRefundIds[0] ?? `order-refund:${response.body.id}`;

  return {
    providerOrderId: response.body.id,
    orderStatus: response.body.status,
    ...(response.body.status_detail
      ? { statusDetail: response.body.status_detail }
      : {}),
    providerRefundIds:
      providerRefundIds.length > 0 ? providerRefundIds : [primaryRefundId],
    refundedAmountMinor: null,
    rawSanitized: sanitizeRefundResponse(response.body),
  };
}
