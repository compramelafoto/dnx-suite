import { createHash, randomUUID } from "node:crypto";
import type { Money } from "../../../money/types.js";
import { money } from "../../../money/index.js";
import type { AppendOnlyLedger } from "../../../ledger/index.js";
import type { PaymentProvider } from "../../../providers/types.js";
import { transitionRefund } from "../../../core/states.js";
import { allocateRefundProportionally } from "./allocations.js";
import {
  assertOrderRefundableStatus,
  assertRefundAuthorized,
} from "./authorize.js";
import { postRefundLedgerEntries } from "./ledger-posting.js";
import {
  getRefundableAmount,
  resolveRefundAmountMinor,
} from "./remaining.js";
import type { RefundStore } from "./store.js";
import type {
  PersistedRefundRecord,
  RefundRequest,
  RefundResult,
} from "./types.js";

export type CreateOrders1nRefundDeps = {
  store: RefundStore;
  provider: Pick<PaymentProvider, "refund" | "getOrder">;
  ledger?: AppendOnlyLedger;
  /** Optional order status from durable DB — defaults to PAID. */
  resolveOrderStatus?: (paymentOrderId: string) => Promise<string>;
};

function payloadHash(input: {
  paymentOrderId: string;
  amountMinor: bigint;
  providerOrderId: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        paymentOrderId: input.paymentOrderId,
        amountMinor: input.amountMinor.toString(),
        providerOrderId: input.providerOrderId,
      }),
    )
    .digest("hex");
}

function toResult(record: PersistedRefundRecord, reused: boolean): RefundResult {
  const remainingHint =
    record.status === "PROCESSED"
      ? undefined
      : undefined;
  void remainingHint;
  return {
    refundId: record.id,
    providerRefundId: record.providerRefundId,
    providerRefundIds: record.providerRefundIds,
    paymentOrderId: record.paymentOrderId,
    providerOrderId: record.providerOrderId,
    amountMinor: record.amountMinor,
    currency: record.currency,
    status: record.status,
    statusDetail: record.statusDetail,
    orderStatusAfter: "PROCESSING",
    createdAt: record.createdAt,
    reused,
    allocations: record.allocations,
    ...(record.rawSanitized
      ? { providerResponseRef: "sanitized" }
      : {}),
  };
}

function orderStatusAfter(
  remainingAfter: bigint,
): RefundResult["orderStatusAfter"] {
  if (remainingAfter === 0n) return "REFUNDED";
  return "PARTIALLY_REFUNDED";
}

/**
 * Canonical Orders 1:N refund service.
 * - Amount reconstructed / validated server-side (remaining)
 * - Idempotent on idempotencyKey + payloadHash
 * - Posts ledger + proportional refund allocations
 */
export function createOrders1nRefundService(deps: CreateOrders1nRefundDeps) {
  return {
    async getRefundableAmount(paymentOrderId: string, orderTotalMinor: bigint, currency: RefundRequest["currency"]) {
      const refunds = await deps.store.listByPaymentOrderId(paymentOrderId);
      return getRefundableAmount({
        paymentOrderId,
        orderTotalMinor,
        currency,
        refunds,
      });
    },

    async listRefundsForPayment(paymentOrderId: string) {
      return deps.store.listByPaymentOrderId(paymentOrderId);
    },

    async getRefund(refundId: string) {
      return deps.store.findById(refundId);
    },

    async createRefund(request: RefundRequest): Promise<RefundResult> {
      assertRefundAuthorized({
        paymentOrderId: request.paymentOrderId,
        actor: request.actor,
      });

      const orderStatus =
        (await deps.resolveOrderStatus?.(request.paymentOrderId)) ?? "PAID";
      assertOrderRefundableStatus(orderStatus);

      const existing = await deps.store.findByIdempotencyKey(
        request.environment,
        request.idempotencyKey,
      );

      const prior = await deps.store.listByPaymentOrderId(request.paymentOrderId);
      const balance = getRefundableAmount({
        paymentOrderId: request.paymentOrderId,
        orderTotalMinor: request.orderTotalMinor,
        currency: request.currency,
        refunds: prior.filter((r) => r.idempotencyKey !== request.idempotencyKey),
      });

      let amountMinor: bigint;
      try {
        amountMinor = resolveRefundAmountMinor({
          requestedAmountMinor: request.amountMinor,
          remainingMinor: balance.remainingMinor,
        });
      } catch (err) {
        if (existing?.status === "PROCESSED") {
          const bal2 = getRefundableAmount({
            paymentOrderId: request.paymentOrderId,
            orderTotalMinor: request.orderTotalMinor,
            currency: request.currency,
            refunds: prior,
          });
          return {
            ...toResult(existing, true),
            orderStatusAfter: orderStatusAfter(bal2.remainingMinor),
          };
        }
        throw err;
      }

      const hash = payloadHash({
        paymentOrderId: request.paymentOrderId,
        amountMinor,
        providerOrderId: request.providerOrderId,
      });

      if (existing) {
        if (existing.payloadHash !== hash) {
          throw Object.assign(
            new Error("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD"),
            { code: "IDEMPOTENCY_PAYLOAD_CONFLICT" },
          );
        }
        const bal = getRefundableAmount({
          paymentOrderId: request.paymentOrderId,
          orderTotalMinor: request.orderTotalMinor,
          currency: request.currency,
          refunds: prior,
        });
        return {
          ...toResult(existing, true),
          orderStatusAfter: orderStatusAfter(bal.remainingMinor),
        };
      }

      const { allocations } = allocateRefundProportionally({
        refundAmountMinor: amountMinor,
        originalAllocations: request.originalAllocations,
      });

      const now = new Date().toISOString();
      const refundId = `dnx_rf_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      let status = transitionRefund("REQUESTED", "SUBMITTED");

      const draft: PersistedRefundRecord = {
        id: refundId,
        paymentOrderId: request.paymentOrderId,
        providerOrderId: request.providerOrderId,
        providerRefundId: null,
        providerRefundIds: [],
        amountMinor,
        currency: request.currency,
        status,
        statusDetail: null,
        idempotencyKey: request.idempotencyKey,
        payloadHash: hash,
        reason: request.reason ?? null,
        allocations,
        environment: request.environment,
        createdAt: now,
        updatedAt: now,
      };
      await deps.store.save(draft);

      const amountMoney: Money | undefined =
        request.amountMinor === undefined && amountMinor === balance.remainingMinor
          ? undefined // total remaining → empty body when remaining == full unpaid path; still pass amount for partial
          : money(request.currency, amountMinor);

      // Total refund only when requesting full remaining AND remaining == order total
      // (first full refund). Partial remaining after prior partials still needs amount+tx.
      const isFullOrderRefund =
        request.amountMinor === undefined &&
        amountMinor === request.orderTotalMinor;

      try {
        const providerResult = await deps.provider.refund({
          providerOrderId: request.providerOrderId,
          idempotencyKey: request.idempotencyKey,
          ...(isFullOrderRefund
            ? {}
            : {
                amount: amountMoney ?? money(request.currency, amountMinor),
                providerTransactionId: request.providerTransactionId,
              }),
        });

        status = transitionRefund("SUBMITTED", "PROCESSED");
        const processed: PersistedRefundRecord = {
          ...draft,
          status,
          providerRefundId: providerResult.providerRefundId,
          providerRefundIds: [providerResult.providerRefundId],
          statusDetail: "processed",
          updatedAt: new Date().toISOString(),
          rawSanitized: { providerRefundIdPrefix: providerResult.providerRefundId.slice(0, 10) + "…" },
        };
        await deps.store.save(processed);

        if (deps.ledger) {
          postRefundLedgerEntries({
            ledger: deps.ledger,
            refundId,
            paymentOrderId: request.paymentOrderId,
            currency: request.currency,
            refundAmountMinor: amountMinor,
            allocations,
          });
        }

        const all = await deps.store.listByPaymentOrderId(request.paymentOrderId);
        const bal = getRefundableAmount({
          paymentOrderId: request.paymentOrderId,
          orderTotalMinor: request.orderTotalMinor,
          currency: request.currency,
          refunds: all,
        });

        return {
          ...toResult(processed, false),
          orderStatusAfter: orderStatusAfter(bal.remainingMinor),
        };
      } catch (error) {
        const failed: PersistedRefundRecord = {
          ...draft,
          status: transitionRefund("SUBMITTED", "FAILED"),
          statusDetail:
            error instanceof Error ? error.message.slice(0, 120) : "provider_failed",
          updatedAt: new Date().toISOString(),
        };
        await deps.store.save(failed);
        throw error;
      }
    },
  };
}

export type Orders1nRefundService = ReturnType<typeof createOrders1nRefundService>;
