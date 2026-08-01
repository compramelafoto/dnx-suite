/**
 * Clickatón → Mercado Pago Orders 1:N TEST bridge (10D3I-H + Imp 03 Brick).
 * Creates split order server-side with card token from Brick (preferred)
 * or sandbox env fallback for CLI smokes.
 */
import { calculateDistribution } from "../../../distribution/calculate.js";
import { money } from "../../../money/index.js";
import type { ClickatonCheckoutProviderBridge } from "./types.js";
import {
  assertOrders1nStagingCreateAllowed,
  isOrders1nStagingFlagEnabled,
} from "../../../providers/mercado-pago/orders/orders-1n-flag.js";
import { isClickatonDnxCheckoutEnabled } from "./checkout-dnx-flag.js";
import type { MercadoPagoOrdersAdapter } from "../../../providers/mercado-pago/orders/adapter.js";
import { testActivePartnerConsent } from "../../../providers/mercado-pago/orders/consent-evidence.js";
import { singleIntangibleItem } from "../../../providers/mercado-pago/orders/order-items.js";
import { mapProviderOrderStatusToCardUiState } from "../../../frontend/status-detail-messages.js";
import type { NormalizedCheckoutStatus } from "./types.js";

export type Orders1nRegistrationBridgeDeps = {
  adapter: MercadoPagoOrdersAdapter;
  ownerUserId: string;
  partnerReceiverId: string;
  partnerReceiverId2: string;
  /** CLI/smoke fallback only — Brick path supplies token per request. */
  paymentToken?: string;
  /** CLI/smoke fallback only — Brick path supplies MP_DEVICE_SESSION_ID. */
  deviceSessionId?: string;
  confirmStaging: boolean;
  confirmOrdersTest: boolean;
  statementDescriptor?: string;
};

function toNormalizedImmediate(
  providerStatus: string,
): NormalizedCheckoutStatus {
  const ui = mapProviderOrderStatusToCardUiState(providerStatus);
  if (ui === "APPROVED") return "APPROVED";
  if (ui === "REJECTED") return "REJECTED";
  if (ui === "PROCESSING") return "PROCESSING";
  return "PENDING";
}

export function createMercadoPagoOrders1nClickatonBridge(
  deps: Orders1nRegistrationBridgeDeps,
): ClickatonCheckoutProviderBridge {
  return {
    mode: "mercado_pago_orders_test",
    providerName: "mercadopago",
    async createCheckout(input) {
      if (!isClickatonDnxCheckoutEnabled()) {
        throw new Error("CLICKATON_DNX_CHECKOUT_FLAG_OFF");
      }

      const paymentToken =
        input.cardPayment?.token?.trim() || deps.paymentToken?.trim() || "";
      const deviceSessionId =
        input.cardPayment?.deviceSessionId?.trim() ||
        deps.deviceSessionId?.trim() ||
        "";
      const paymentMethodId =
        input.cardPayment?.paymentMethodId?.trim() || "visa";
      const installments = input.cardPayment?.installments ?? 1;
      const payerEmail =
        input.cardPayment?.payer.email?.trim() || input.payerEmail?.trim() || "";

      if (!deviceSessionId) {
        throw new Error(
          "DEVICE_SESSION_REQUIRED: DEVICE CONTEXT FRONTEND BLOCKED UNTIL BRICK",
        );
      }
      if (!paymentToken) {
        throw new Error("CARD_TOKEN_REQUIRED: Brick token or TEST payment token required");
      }
      if (!payerEmail) {
        throw new Error("PAYER_EMAIL_REQUIRED: buyer email required for Orders 1:N");
      }

      const gate = assertOrders1nStagingCreateAllowed({
        flagEnabled: isOrders1nStagingFlagEnabled(),
        environment: "sandbox",
        confirmStaging: deps.confirmStaging,
        confirmOrdersTest: deps.confirmOrdersTest,
        accessTokenPresent: true,
        accessTokenSandboxEligible: true,
        ownerUserIdPresent: Boolean(deps.ownerUserId.trim()),
        receiver1Present: Boolean(deps.partnerReceiverId.trim()),
        receiver2Present: Boolean(deps.partnerReceiverId2.trim()),
        paymentTokenPresent: Boolean(paymentToken),
        deviceIdPresent: Boolean(deviceSessionId),
      });
      if (!gate.ok) {
        throw new Error(`ORDERS_1N_GATE:${gate.reason}`);
      }

      const total = money(input.currency, BigInt(input.amountMinor));
      const distribution = calculateDistribution({
        total,
        rules: [
          {
            recipientId: "dani",
            role: "OTHER",
            kind: "PERCENTAGE",
            percentageBps: 3400,
            priority: 1,
            optional: false,
          },
          {
            recipientId: "rodri",
            role: "OTHER",
            kind: "PERCENTAGE",
            percentageBps: 3300,
            priority: 2,
            optional: false,
          },
          {
            recipientId: "tammy",
            role: "OTHER",
            kind: "PERCENTAGE",
            percentageBps: 3300,
            priority: 3,
            optional: false,
          },
        ],
        rounding: "LARGEST_REMAINDER",
        eligibleRecipientIds: ["dani", "rodri", "tammy"],
      });

      const partnerReceiverIds = new Map([
        ["rodri", deps.partnerReceiverId],
        ["tammy", deps.partnerReceiverId2],
      ]);
      const partnerConsentsByRecipientId = new Map([
        ["rodri", testActivePartnerConsent(deps.partnerReceiverId)],
        ["tammy", testActivePartnerConsent(deps.partnerReceiverId2)],
      ]);

      const created = await deps.adapter.createSplitOrder({
        environment: "sandbox",
        externalReference: input.externalReference,
        total,
        distribution,
        idempotencyKey: input.idempotencyKey,
        deviceSessionId,
        paymentToken,
        paymentMethodId,
        installments,
        payerEmail,
        statementDescriptor: deps.statementDescriptor ?? "CLICKATON",
        items: [
          singleIntangibleItem({
            title: "Inscripcion Clickaton",
            total,
            categoryId: "others",
            id: input.sourceId,
          }),
        ],
        partnerReceiverIds,
        partnerConsentsByRecipientId,
        metadata: {
          sourceId: input.sourceId,
          stage: "10D3I-H-BRICK",
          payloadHashPrefix: input.payloadHash.slice(0, 12),
        },
      });

      const immediateStatus = toNormalizedImmediate(created.status);
      const checkoutUrl =
        immediateStatus === "APPROVED"
          ? input.successUrl
          : immediateStatus === "REJECTED"
            ? input.failureUrl
            : input.pendingUrl;

      return {
        checkoutUrl,
        providerOrderId: created.providerOrderId,
        immediateStatus,
        statusDetail:
          typeof created.raw === "object" &&
          created.raw &&
          "status_detail" in created.raw &&
          typeof (created.raw as { status_detail?: unknown }).status_detail === "string"
            ? (created.raw as { status_detail: string }).status_detail
            : created.status,
        rawSanitized: {
          mode: "mercado_pago_orders_test",
          providerOrderIdPrefix: created.providerOrderId.slice(0, 10) + "…",
          status: created.status,
          immediateStatus,
          externalReference: input.externalReference,
          liveMode: false,
          brickPath: Boolean(input.cardPayment),
        },
      };
    },
    async refreshCheckout(input) {
      const got = await deps.adapter.getOrder(input.providerOrderId, "sandbox");
      const approved =
        got.status === "PROCESSED_ACCREDITED" || got.status === "PROCESSED";
      return {
        status: approved
          ? "APPROVED"
          : got.status.startsWith("UNKNOWN")
            ? "PENDING"
            : got.status === "FAILED"
              ? "REJECTED"
              : "PROCESSING",
        amountMinor: input.expectedAmountMinor,
        currency: input.expectedCurrency,
        externalReference: input.externalReference,
        liveMode: false,
        rawSanitized: {
          providerOrderIdPrefix: got.providerOrderId.slice(0, 10) + "…",
          status: got.status,
          statusDetail: got.statusDetail ?? null,
        },
      };
    },
  };
}
